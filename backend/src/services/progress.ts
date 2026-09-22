import { db } from '../db';
import { enrollments, lessonProgress, lessons, courseSections, courses } from '../db/schema';
import { eq, and, count, sql } from 'drizzle-orm';
import { generateCertificate } from './certificate';

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
