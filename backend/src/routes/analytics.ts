import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import {
  users, courses, enrollments, lessonProgress, courseSections, lessons, quizzes,
  quizAttempts, assignments, assignmentSubmissions,
} from '../db/schema';
import { eq, and, count, desc, sql, inArray, gte } from 'drizzle-orm';
import { authMiddleware, roleMiddleware } from '../middleware/jwt';

const analyticsRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string };

async function assertCourseAccess(courseId: string, payload: JwtPayload) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return null;
  const allowed = payload.role === 'admin' || course.instructorId === payload.id;
  return allowed ? course : false;
}

// ============================================================
// GET /overview — Stats global platform (admin)
// ============================================================
const overviewRoute = createRoute({
  method: 'get',
  path: '/overview',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  responses: { 200: { description: 'Overview', content: { 'application/json': { schema: z.any() } } } },
});

analyticsRoutes.openapi(overviewRoute, async (c) => {
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const [userRow] = await db.select({ value: count() }).from(users);
  const [teacherRow] = await db.select({ value: count() }).from(users).where(eq(users.role, 'teacher'));
  const [courseRow] = await db.select({ value: count() }).from(courses).where(eq(courses.status, 'published'));
  const [enrollRow] = await db.select({ value: count() }).from(enrollments);
  const [completedRow] = await db.select({ value: count() }).from(enrollments).where(eq(enrollments.status, 'completed'));
  const [newUsersRow] = await db.select({ value: count() }).from(users).where(gte(users.createdAt, monthAgo));
  const [newEnrollRow] = await db.select({ value: count() }).from(enrollments).where(gte(enrollments.enrolledAt, monthAgo));

  // Top kursus berdasarkan jumlah peserta
  const topCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      totalEnrolled: sql<number>`count(*)::int`,
    })
    .from(courses)
    .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
    .where(eq(courses.status, 'published'))
    .groupBy(courses.id, courses.title, courses.slug)
    .orderBy(desc(sql`count(*)::int`))
    .limit(5);

  // Aktivitas terbaru: enrollment terakhir
  const recentEnrollments = await db
    .select({
      userId: users.name,
      courseTitle: courses.title,
      enrolledAt: enrollments.enrolledAt,
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .orderBy(desc(enrollments.enrolledAt))
    .limit(5);

  return c.json({
    totals: {
      users: userRow?.value ?? 0,
      teachers: teacherRow?.value ?? 0,
      publishedCourses: courseRow?.value ?? 0,
      enrollments: enrollRow?.value ?? 0,
      completedEnrollments: completedRow?.value ?? 0,
    },
    thisMonth: {
      newUsers: newUsersRow?.value ?? 0,
      newEnrollments: newEnrollRow?.value ?? 0,
    },
    topCourses: topCourses.map((t) => ({ ...t, totalEnrolled: t.totalEnrolled ?? 0 })),
    recentEnrollments,
  }, 200);
});

// ============================================================
// GET /courses/:courseId — Stats per kursus (owner/admin)
// ============================================================
const courseStatsRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}',
  middleware: [authMiddleware],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  responses: { 200: { description: 'Course stats' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

analyticsRoutes.openapi(courseStatsRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');

  const course = await assertCourseAccess(courseId, payload);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan atau Anda tidak berwenang' }, 403);

  const [enrollRow] = await db.select({ value: count() }).from(enrollments).where(eq(enrollments.courseId, courseId));
  const totalEnrolled = enrollRow?.value ?? 0;

  const [completedRow] = await db.select({ value: count() }).from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.status, 'completed')));
  const completedCount = completedRow?.value ?? 0;

  const [avgProgressRow] = await db
    .select({ avg: sql<number>`coalesce(avg(progress), 0)` })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId));

  // Quiz stats (quizzes → lessons → courseSections → courses)
  const [attemptCountRow] = await db
    .select({ value: count() })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
    .where(eq(courseSections.courseId, courseId));
  const [passedAttemptRow] = await db
    .select({ value: count() })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
    .where(and(eq(courseSections.courseId, courseId), eq(quizAttempts.isPassed, true)));

  // Assignment stats (assignments → lessons → courseSections → courses)
  const [assignmentCountRow] = await db
    .select({ value: count() })
    .from(assignments)
    .innerJoin(lessons, eq(assignments.lessonId, lessons.id))
    .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
    .where(eq(courseSections.courseId, courseId));
  const [submissionCountRow] = await db
    .select({ value: count() })
    .from(assignmentSubmissions)
    .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
    .innerJoin(lessons, eq(assignments.lessonId, lessons.id))
    .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
    .where(eq(courseSections.courseId, courseId));

  return c.json({
    totalEnrolled,
    completedCount,
    completionRate: totalEnrolled > 0 ? Math.round((completedCount / totalEnrolled) * 100) : 0,
    averageProgress: Math.round(Number(avgProgressRow?.avg ?? 0)),
    quizStats: {
      totalAttempts: attemptCountRow?.value ?? 0,
      passedAttempts: passedAttemptRow?.value ?? 0,
      passRate: (attemptCountRow?.value ?? 0) > 0 ? Math.round(((passedAttemptRow?.value ?? 0) / (attemptCountRow?.value ?? 0)) * 100) : 0,
    },
    assignmentStats: {
      totalAssignments: assignmentCountRow?.value ?? 0,
      totalSubmissions: submissionCountRow?.value ?? 0,
    },
    rating: { averageRating: course.averageRating, totalReviews: course.totalReviews },
  }, 200);
});

// ============================================================
// GET /courses/:courseId/completion-funnel — Funnel per section (owner/admin)
// ============================================================
const funnelRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}/completion-funnel',
  middleware: [authMiddleware],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  responses: { 200: { description: 'Funnel' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

analyticsRoutes.openapi(funnelRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');

  const course = await assertCourseAccess(courseId, payload);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan atau Anda tidak berwenang' }, 403);

  const [enrollRow] = await db.select({ value: count() }).from(enrollments).where(eq(enrollments.courseId, courseId));
  const totalEnrolled = enrollRow?.value ?? 0;

  // Urutan section
  const sections = await db
    .select({ id: courseSections.id, title: courseSections.title, sortOrder: courseSections.sortOrder })
    .from(courseSections)
    .where(eq(courseSections.courseId, courseId))
    .orderBy(courseSections.sortOrder);

  // Semua lesson per section
  const lessonsBySection = new Map<string, string[]>();
  if (sections.length > 0) {
    const allLessons = await db
      .select({ sectionId: lessons.sectionId, id: lessons.id })
      .from(lessons)
      .where(inArray(lessons.sectionId, sections.map((s) => s.id)));
    for (const l of allLessons) {
      if (!lessonsBySection.has(l.sectionId)) lessonsBySection.set(l.sectionId, []);
      lessonsBySection.get(l.sectionId)!.push(l.id);
    }
  }

  // Progress completion per user per lesson
  const progressRows = await db
    .select({ userId: lessonProgress.userId, lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.courseId, courseId), eq(lessonProgress.isCompleted, true)));

  const completedByUser = new Map<string, Set<string>>();
  for (const p of progressRows) {
    if (!completedByUser.has(p.userId)) completedByUser.set(p.userId, new Set());
    completedByUser.get(p.userId)!.add(p.lessonId);
  }

  const funnel = sections.map((sec) => {
    const lessonIds = lessonsBySection.get(sec.id) ?? [];
    let usersCompleted = 0;
    if (lessonIds.length > 0) {
      for (const [userId, set] of completedByUser) {
        void userId;
        if (lessonIds.every((lid) => set.has(lid))) usersCompleted += 1;
      }
    } else {
      // Section tanpa lesson: semua user dianggap "lolos"
      usersCompleted = totalEnrolled;
    }
    return {
      sectionId: sec.id,
      title: sec.title,
      sortOrder: sec.sortOrder,
      lessonCount: lessonIds.length,
      usersCompleted,
      percentage: totalEnrolled > 0 ? Math.round((usersCompleted / totalEnrolled) * 100) : 0,
    };
  });

  return c.json({ totalEnrolled, funnel }, 200);
});

export default analyticsRoutes;
