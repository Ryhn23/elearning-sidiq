import { db } from '../db';
import {
  enrollments,
  lessonProgress,
  lessons,
  courseSections,
  courses,
  users,
  quizzes,
  quizAttempts,
  assignments,
  assignmentSubmissions,
} from '../db/schema';
import { eq, and, count, inArray, isNotNull, sql } from 'drizzle-orm';
import { generateCertificate } from './certificate';
import { enqueueGradeSync } from './sidiqClient';

/**
 * Hitung rata-rata kuis, tugas, dan nilai akhir siswa dalam satu kursus.
 */
export async function calculateUserCourseGrade(userId: string, courseId: string) {
  const sectionsOfCourse = await db
    .select({ id: courseSections.id })
    .from(courseSections)
    .where(eq(courseSections.courseId, courseId));
  const sectionIds = sectionsOfCourse.map((s) => s.id);
  if (sectionIds.length === 0) return { quizAvg: null, assignmentAvg: null, finalGrade: null, letterGrade: null };

  const lessonsOfCourse = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(inArray(lessons.sectionId, sectionIds));
  const lessonIds = lessonsOfCourse.map((l) => l.id);
  if (lessonIds.length === 0) return { quizAvg: null, assignmentAvg: null, finalGrade: null, letterGrade: null };

  // 1. Kuis: ambil attempt terbaik per kuis, lalu rata-ratakan
  const quizzesInCourse = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(inArray(quizzes.lessonId, lessonIds));

  let quizAvg: number | null = null;
  if (quizzesInCourse.length > 0) {
    const attempts = await db
      .select({ quizId: quizAttempts.quizId, percentage: quizAttempts.percentage })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.userId, userId),
          inArray(quizAttempts.quizId, quizzesInCourse.map((q) => q.id)),
          isNotNull(quizAttempts.percentage)
        )
      );

    const bestMap = new Map<string, number>();
    for (const a of attempts) {
      if (a.percentage == null) continue;
      const prev = bestMap.get(a.quizId) ?? -1;
      if (a.percentage > prev) bestMap.set(a.quizId, a.percentage);
    }
    if (bestMap.size > 0) {
      let sum = 0;
      for (const val of bestMap.values()) sum += val;
      quizAvg = Math.round(sum / bestMap.size);
    }
  }

  // 2. Tugas: rata-rata nilai tugas yang sudah dinilai
  const assignmentsInCourse = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(inArray(assignments.lessonId, lessonIds));

  let assignmentAvg: number | null = null;
  if (assignmentsInCourse.length > 0) {
    const subs = await db
      .select({ score: assignmentSubmissions.score })
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.userId, userId),
          inArray(assignmentSubmissions.assignmentId, assignmentsInCourse.map((a) => a.id)),
          eq(assignmentSubmissions.status, 'graded'),
          isNotNull(assignmentSubmissions.score)
        )
      );
    if (subs.length > 0) {
      let sum = 0;
      for (const s of subs) sum += s.score!;
      assignmentAvg = Math.round(sum / subs.length);
    }
  }

  // 3. Nilai akhir: bobot 60% kuis + 40% tugas
  let finalGrade: number | null = null;
  if (quizAvg !== null && assignmentAvg !== null) {
    finalGrade = Math.round(0.6 * quizAvg + 0.4 * assignmentAvg);
  } else if (quizAvg !== null) {
    finalGrade = quizAvg;
  } else if (assignmentAvg !== null) {
    finalGrade = assignmentAvg;
  }

  let letterGrade: string | null = null;
  if (finalGrade !== null) {
    if (finalGrade >= 85) letterGrade = 'A';
    else if (finalGrade >= 70) letterGrade = 'B';
    else if (finalGrade >= 55) letterGrade = 'C';
    else if (finalGrade >= 40) letterGrade = 'D';
    else letterGrade = 'E';
  }

  return { quizAvg, assignmentAvg, finalGrade, letterGrade };
}

/**
 * Recalculate enrollment progress for a user in a course.
 * Dipanggil setiap kali lesson_progress diupdate (complete/uncomplete).
 *
 * 1. Hitung: completedLessons / totalVisibleLessons * 100
 * 2. Update: enrollments.progress
 * 3. Jika progress = 100% → status 'completed' + completed_at
 */
export async function recalculateProgress(userId: string, courseId: string): Promise<void> {
  // Total lesson visible dalam kursus
  const [totalRow] = await db
    .select({ value: count() })
    .from(lessons)
    .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
    .where(and(eq(courseSections.courseId, courseId), eq(lessons.isVisible, true)));

  const totalLessons = totalRow?.value ?? 0;

  // Jumlah lesson yang sudah selesai oleh user
  const [doneRow] = await db
    .select({ value: count() })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.courseId, courseId),
        eq(lessonProgress.isCompleted, true)
      )
    );

  const completedLessons = doneRow?.value ?? 0;

  const progress = totalLessons > 0 ? Math.min(100, (completedLessons / totalLessons) * 100) : 0;

  if (progress >= 100) {
    await db
      .update(enrollments)
      .set({
        progress: 100,
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));

    // Auto-generate sertifikat jika kursus mengaktifkan sertifikat
    const [course] = await db.select({ certificateEnabled: courses.certificateEnabled }).from(courses).where(eq(courses.id, courseId)).limit(1);
    if (course?.certificateEnabled) {
      generateCertificate(userId, courseId).catch((err) => console.error('[progress] Gagal auto-generate sertifikat:', err));
    }
  } else {
    await db
      .update(enrollments)
      .set({
        progress,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
  }

  // Sinkronisasi progress & status ke SIDIQ jika user terhubung dengan SIDIQ
  try {
    const [user] = await db.select({ sidiqEntityId: users.sidiqEntityId }).from(users).where(eq(users.id, userId)).limit(1);
    const [courseRow] = await db.select({ title: courses.title, slug: courses.slug, sidiqPelajaranId: courses.sidiqPelajaranId }).from(courses).where(eq(courses.id, courseId)).limit(1);
    if (user?.sidiqEntityId && courseRow) {
      const grades = await calculateUserCourseGrade(userId, courseId);
      void enqueueGradeSync({
        santriId: user.sidiqEntityId,
        courseId,
        courseTitle: courseRow.title,
        courseSlug: courseRow.slug,
        pelajaranId: courseRow.sidiqPelajaranId || undefined,
        progressPercent: progress,
        quizAverage: grades.quizAvg ?? undefined,
        assignmentAverage: grades.assignmentAvg ?? undefined,
        finalGrade: grades.finalGrade ?? undefined,
        letterGrade: grades.letterGrade ?? undefined,
        status: progress >= 100 ? 'completed' : 'active',
        completedAt: progress >= 100 ? new Date().toISOString() : null,
      }).catch((e) => console.error('[sidiqSync] progress sync error:', e));
    }
  } catch (err) {
    console.error('[sidiqSync] failed to enqueue progress:', err);
  }
}

/**
 * Ambil progress detail per lesson untuk satu kursus (untuk sidebar player).
 */
export async function getCourseProgressDetail(userId: string, courseId: string) {
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));

  if (!enrollment) return null;

  const progressRows = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.courseId, courseId)));

  const progressMap = new Map<string, typeof progressRows[number]>();
  for (const row of progressRows) progressMap.set(row.lessonId, row);

  return { enrollment, progressMap };
}
