import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import {
  courses, enrollments, lessonProgress, users,
  quizzes, quizAttempts, lessons, courseSections,
  assignments, assignmentSubmissions,
} from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware, roleMiddleware } from '../middleware/jwt';
import { sendEnrollmentConfirmed } from '../services/email';

const enrollmentRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string; email: string; name: string };

// POST /courses/:courseId — Enroll ke kursus
const enrollRoute = createRoute({
  method: 'post',
  path: '/courses/{courseId}',
  middleware: [authMiddleware],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  responses: {
    201: { description: 'Enrolled', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
    409: { description: 'Already enrolled' },
  },
});

enrollmentRoutes.openapi(enrollRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (course.status !== 'published') return c.json({ error: 'Kursus belum dipublish' }, 403);

  const [existing] = await db.select().from(enrollments)
    .where(and(eq(enrollments.userId, payload.id), eq(enrollments.courseId, courseId)))
    .limit(1);
  if (existing) return c.json({ error: 'Anda sudah enrolled di kursus ini' }, 409);

  const [row] = await db.insert(enrollments).values({ userId: payload.id, courseId }).returning();

  // Denormalisasi totalEnrolled
  await db.update(courses).set({ totalEnrolled: sql`total_enrolled + 1` }).where(eq(courses.id, courseId));

  // Email konfirmasi (fire-and-forget)
  void sendEnrollmentConfirmed(payload.email, payload.name, course.title).catch((e) => console.error('[email] enrollment:', e));

  return c.json(row as any, 201);
});

// DELETE /courses/:courseId — Keluar dari kursus
const unenrollRoute = createRoute({
  method: 'delete',
  path: '/courses/{courseId}',
  middleware: [authMiddleware],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  responses: {
    204: { description: 'Unenrolled' },
    404: { description: 'Not Found' },
  },
});

enrollmentRoutes.openapi(unenrollRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');

  const [row] = await db.delete(enrollments)
    .where(and(eq(enrollments.userId, payload.id), eq(enrollments.courseId, courseId)))
    .returning({ id: enrollments.id });
  if (!row) return c.json({ error: 'Enrollment tidak ditemukan' }, 404);

  await db.update(courses).set({ totalEnrolled: sql`greatest(total_enrolled - 1, 0)` }).where(eq(courses.id, courseId));

  return c.body(null, 204);
});

// GET /my — List kursus yang diikuti sendiri (+ progress)
const myRoute = createRoute({
  method: 'get',
  path: '/my',
  middleware: [authMiddleware],
  responses: { 200: { description: 'My enrollments', content: { 'application/json': { schema: z.any() } } } },
});

enrollmentRoutes.openapi(myRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;

  const rows = await db
    .select({ course: courses, enrollment: enrollments, category: courses.categoryId })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, payload.id))
    .orderBy(desc(enrollments.enrolledAt));

  const data = rows.map((r) => ({
    ...r.enrollment,
    course: {
      id: r.course.id,
      slug: r.course.slug,
      title: r.course.title,
      thumbnailUrl: r.course.thumbnailUrl,
      shortDescription: r.course.shortDescription,
      totalEnrolled: r.course.totalEnrolled,
      averageRating: r.course.averageRating,
    },
  }));

  return c.json({ data }, 200);
});

// GET /my/:courseId/progress — Progress detail per lesson
const progressRoute = createRoute({
  method: 'get',
  path: '/my/{courseId}/progress',
  middleware: [authMiddleware],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  responses: {
    200: { description: 'Progress detail', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Not Found' },
  },
});

enrollmentRoutes.openapi(progressRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');

  const [enrollment] = await db.select().from(enrollments)
    .where(and(eq(enrollments.userId, payload.id), eq(enrollments.courseId, courseId)))
    .limit(1);
  if (!enrollment) return c.json({ error: 'Enrollment tidak ditemukan' }, 404);

  const progressRows = await db.select().from(lessonProgress)
    .where(and(eq(lessonProgress.userId, payload.id), eq(lessonProgress.courseId, courseId)));

  return c.json({
    enrollment,
    lessons: progressRows.map((p) => ({
      lessonId: p.lessonId,
      isCompleted: p.isCompleted,
      videoPosition: p.videoPosition,
      completedAt: p.completedAt,
      lastAccessAt: p.lastAccessAt,
    })),
  }, 200);
});

// POST /admin/courses/:courseId/users/:userId — Enroll manual (admin)
const adminEnrollRoute = createRoute({
  method: 'post',
  path: '/admin/courses/{courseId}/users/{userId}',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { params: z.object({ courseId: z.string().uuid(), userId: z.string().uuid() }) },
  responses: {
    201: { description: 'Enrolled', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Not Found' },
    409: { description: 'Already enrolled' },
  },
});

enrollmentRoutes.openapi(adminEnrollRoute, async (c) => {
  const { courseId, userId } = c.req.valid('param');

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User tidak ditemukan' }, 404);

  const [existing] = await db.select().from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  if (existing) return c.json({ error: 'User sudah enrolled di kursus ini' }, 409);

  const [row] = await db.insert(enrollments).values({ userId, courseId }).returning();
  await db.update(courses).set({ totalEnrolled: sql`total_enrolled + 1` }).where(eq(courses.id, courseId));

  return c.json(row as any, 201);
});

// PATCH /admin/:enrollmentId/suspend — Suspend/aktifkan enrollment (admin)
const suspendRoute = createRoute({
  method: 'patch',
  path: '/admin/{enrollmentId}/suspend',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { params: z.object({ enrollmentId: z.string().uuid() }) },
  responses: {
    200: { description: 'Status updated', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Not Found' },
  },
});

enrollmentRoutes.openapi(suspendRoute, async (c) => {
  const { enrollmentId } = c.req.valid('param');

  const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
  if (!enrollment) return c.json({ error: 'Enrollment tidak ditemukan' }, 404);

  const newStatus = enrollment.status === 'suspended' ? 'active' : 'suspended';
  const [row] = await db.update(enrollments).set({ status: newStatus, updatedAt: new Date() }).where(eq(enrollments.id, enrollmentId)).returning();

  return c.json(row as any, 200);
});

// ============================================================
// GET /my/grades — Rekap nilai user (quiz + tugas)
// ============================================================
const myGradesRoute = createRoute({
  method: 'get',
  path: '/my/grades',
  middleware: [authMiddleware],
  responses: { 200: { description: 'My grades', content: { 'application/json': { schema: z.any() } } } },
});

enrollmentRoutes.openapi(myGradesRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;

  // Quiz attempts user ini (via quizzes → lessons → sections → courses)
  const quizRows = await db
    .select({
      attemptId: quizAttempts.id,
      score: quizAttempts.score,
      maxScore: quizAttempts.maxScore,
      percentage: quizAttempts.percentage,
      isPassed: quizAttempts.isPassed,
      submittedAt: quizAttempts.submittedAt,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
    .innerJoin(courses, eq(courseSections.courseId, courses.id))
    .where(eq(quizAttempts.userId, payload.id))
    .orderBy(desc(quizAttempts.submittedAt));

  // Submission tugas user ini yang sudah dinilai
  const assignmentRows = await db
    .select({
      submissionId: assignmentSubmissions.id,
      score: assignmentSubmissions.score,
      feedback: assignmentSubmissions.feedback,
      status: assignmentSubmissions.status,
      submittedAt: assignmentSubmissions.submittedAt,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(assignmentSubmissions)
    .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
    .innerJoin(lessons, eq(assignments.lessonId, lessons.id))
    .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
    .innerJoin(courses, eq(courseSections.courseId, courses.id))
    .where(and(eq(assignmentSubmissions.userId, payload.id), eq(assignmentSubmissions.status, 'graded')))
    .orderBy(desc(assignmentSubmissions.submittedAt));

  return c.json({ quizzes: quizRows, assignments: assignmentRows }, 200);
});

export default enrollmentRoutes;
