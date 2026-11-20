import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import {
  courses, courseSections, lessons, assignments, assignmentSubmissions,
  lessonProgress, enrollments, users,
} from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/jwt';
import { streamToFile } from '../services/storage';
import { parseMultipart } from '../services/multipart';
import { recalculateProgress } from '../services/progress';
import { sendAssignmentGraded } from '../services/email';

const assignmentRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string; email: string; name: string };

// ============================================================
// HELPERS
// ============================================================

async function getAssignmentContext(assignmentId: string) {
  const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (!assignment) return null;
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, assignment.lessonId)).limit(1);
  if (!lesson) return null;
  const [section] = await db.select().from(courseSections).where(eq(courseSections.id, lesson.sectionId)).limit(1);
  if (!section) return null;
  const [course] = await db.select().from(courses).where(eq(courses.id, section.courseId)).limit(1);
  if (!course) return null;
  return { assignment, lesson, section, course };
}

function canManage(course: any, payload: JwtPayload): boolean {
  return payload.role === 'admin' || course.instructorId === payload.id;
}

async function isEnrolled(userId: string, courseId: string) {
  const [row] = await db.select({ id: enrollments.id }).from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return !!row;
}

// ============================================================
// POST /lessons/:lessonId — Buat assignment (owner/admin)
// ============================================================
const CreateAssignmentSchema = z.object({
  dueDate: z.string().datetime().optional(),
  maxScore: z.number().int().min(1).default(100),
  allowedFileTypes: z.array(z.enum(['pdf', 'docx', 'zip', 'jpg', 'png'])).default(['pdf', 'docx', 'zip']),
  maxFileSizeMb: z.number().int().min(1).max(50).default(10),
});

const createAssignmentRoute = createRoute({
  method: 'post',
  path: '/lessons/{lessonId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ lessonId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: CreateAssignmentSchema } } },
  },
  responses: { 201: { description: 'Created', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' }, 409: { description: 'Conflict' } },
});

assignmentRoutes.openapi(createAssignmentRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { lessonId } = c.req.valid('param');
  const body = c.req.valid('json');

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson) return c.json({ error: 'Lesson tidak ditemukan' }, 404);

  const [section] = await db.select().from(courseSections).where(eq(courseSections.id, lesson.sectionId)).limit(1);
  const [course] = await db.select().from(courses).where(eq(courses.id, section.courseId)).limit(1);
  if (!course) return c.json({ error: 'Konteks kursus tidak ditemukan' }, 404);
  if (!canManage(course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [existing] = await db.select().from(assignments).where(eq(assignments.lessonId, lessonId)).limit(1);
  if (existing) return c.json({ error: 'Lesson ini sudah memiliki assignment' }, 409);

  const [row] = await db.insert(assignments).values({
    lessonId,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    maxScore: body.maxScore,
    allowedFileTypes: body.allowedFileTypes,
    maxFileSizeMb: body.maxFileSizeMb,
  }).returning();

  return c.json(row as any, 201);
});

// ============================================================
// PUT /:assignmentId — Edit setting (owner/admin)
// ============================================================
const UpdateAssignmentSchema = z.object({
  dueDate: z.string().datetime().nullable().optional(),
  maxScore: z.number().int().min(1).optional(),
  allowedFileTypes: z.array(z.enum(['pdf', 'docx', 'zip', 'jpg', 'png'])).optional(),
  maxFileSizeMb: z.number().int().min(1).max(50).optional(),
});

const updateAssignmentRoute = createRoute({
  method: 'put',
  path: '/{assignmentId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ assignmentId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateAssignmentSchema } } },
  },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

assignmentRoutes.openapi(updateAssignmentRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { assignmentId } = c.req.valid('param');
  const body = c.req.valid('json');

  const ctx = await getAssignmentContext(assignmentId);
  if (!ctx) return c.json({ error: 'Assignment tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) values[k === 'dueDate' ? 'dueDate' : k] = k === 'dueDate' ? new Date(v as string) : v;
  }
  const [row] = await db.update(assignments).set(values as any).where(eq(assignments.id, assignmentId)).returning();
  return c.json(row as any, 200);
});

// ============================================================
// GET /:assignmentId — Detail (enrolled/owner/admin)
// ============================================================
const getAssignmentRoute = createRoute({
  method: 'get',
  path: '/{assignmentId}',
  middleware: [authMiddleware],
  request: { params: z.object({ assignmentId: z.string().uuid() }) },
  responses: { 200: { description: 'Detail', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

assignmentRoutes.openapi(getAssignmentRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { assignmentId } = c.req.valid('param');

  const ctx = await getAssignmentContext(assignmentId);
  if (!ctx) return c.json({ error: 'Assignment tidak ditemukan' }, 404);

  const hasAccess = canManage(ctx.course, payload) || (await isEnrolled(payload.id, ctx.course.id));
  if (!hasAccess) return c.json({ error: 'Anda harus enrolled untuk mengakses assignment ini' }, 403);

  // Sertakan status submission sendiri (untuk student)
  let mySubmission = null;
  if (!canManage(ctx.course, payload)) {
    const [sub] = await db.select().from(assignmentSubmissions)
      .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.userId, payload.id)))
      .limit(1);
    mySubmission = sub || null;
  }

  return c.json({ assignment: ctx.assignment, lesson: ctx.lesson, mySubmission }, 200);
});

// ============================================================
// GET /lessons/:lessonId — Cari assignment berdasarkan lesson
// (dipakai course editor & widget; 404 jika belum ada)
// ============================================================
const getByLessonRoute = createRoute({
  method: 'get',
  path: '/lessons/{lessonId}',
  middleware: [authMiddleware],
  request: { params: z.object({ lessonId: z.string().uuid() }) },
  responses: {
    200: { description: 'Assignment detail', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

assignmentRoutes.openapi(getByLessonRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { lessonId } = c.req.valid('param');

  const [row] = await db.select().from(assignments).where(eq(assignments.lessonId, lessonId)).limit(1);
  if (!row) return c.json({ error: 'Lesson ini belum memiliki assignment' }, 404);

  const ctx = await getAssignmentContext(row.id);
  if (!ctx) return c.json({ error: 'Assignment tidak ditemukan' }, 404);

  const hasAccess = canManage(ctx.course, payload) || (await isEnrolled(payload.id, ctx.course.id));
  if (!hasAccess) return c.json({ error: 'Anda harus enrolled untuk mengakses assignment ini' }, 403);

  return c.json({ assignment: ctx.assignment, lesson: ctx.lesson }, 200);
});

// ============================================================
// POST /:assignmentId/submissions — Submit file (student enrolled)
// ============================================================
const submitAssignmentRoute = createRoute({
  method: 'post',
  path: '/{assignmentId}/submissions',
  middleware: [authMiddleware],
  request: { params: z.object({ assignmentId: z.string().uuid() }) },
  responses: {
    201: { description: 'Submitted', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Bad Request' },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
    409: { description: 'Conflict' },
  },
});

assignmentRoutes.openapi(submitAssignmentRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { assignmentId } = c.req.valid('param');

  const ctx = await getAssignmentContext(assignmentId);
  if (!ctx) return c.json({ error: 'Assignment tidak ditemukan' }, 404);
  if (payload.role === 'admin') return c.json({ error: 'Admin tidak dapat submit tugas' }, 403);
  if (!(await isEnrolled(payload.id, ctx.course.id))) {
    return c.json({ error: 'Anda harus enrolled untuk submit tugas ini' }, 403);
  }

  // Cek tenggat
  if (ctx.assignment.dueDate && new Date(ctx.assignment.dueDate) < new Date()) {
    return c.json({ error: 'Tenggat submission sudah lewat' }, 403);
  }

  // Cek sudah submit (unique per user)
  const [existing] = await db.select().from(assignmentSubmissions)
    .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.userId, payload.id)))
    .limit(1);
  if (existing) return c.json({ error: 'Anda sudah submit tugas ini' }, 409);

  // Parse multipart + streaming ke disk
  const maxBytes = (ctx.assignment.maxFileSizeMb ?? 10) * 1024 * 1024;
  const parsed = await parseMultipart(c, maxBytes);
  if (!parsed) return c.json({ error: 'Tidak ada file dalam request' }, 400);

  // Validasi ekstensi
  const ext = (parsed.name.split('.').pop() || '').toLowerCase();
  const allowed = ctx.assignment.allowedFileTypes ?? ['pdf', 'docx', 'zip'];
  if (!allowed.includes(ext)) {
    return c.json({ error: `Tipe file .${ext} tidak diizinkan. Yang diizinkan: ${allowed.join(', ')}` }, 400);
  }

  const result = await streamToFile(parsed.file, 'assignment', parsed.name, parsed.mimeType, maxBytes);
  if ('error' in result) return c.json({ error: result.error }, 400);

  const [submission] = await db.insert(assignmentSubmissions).values({
    assignmentId,
    userId: payload.id,
    fileUrl: result.url,
    fileName: result.fileName,
    fileSizeBytes: result.sizeBytes,
    status: 'submitted',
  }).returning();

  // Tandai lesson selesai (student sudah submit)
  await db.insert(lessonProgress).values({
    userId: payload.id,
    lessonId: ctx.lesson.id,
    courseId: ctx.course.id,
    isCompleted: true,
    completedAt: new Date(),
    lastAccessAt: new Date(),
  }).onConflictDoUpdate({
    target: [lessonProgress.userId, lessonProgress.lessonId],
    set: { isCompleted: true, completedAt: new Date(), lastAccessAt: new Date() },
  });
  await recalculateProgress(payload.id, ctx.course.id);

  return c.json(submission as any, 201);
});

// ============================================================
// GET /:assignmentId/submissions — Semua submission (teacher/admin)
// ============================================================
const listSubmissionsRoute = createRoute({
  method: 'get',
  path: '/{assignmentId}/submissions',
  middleware: [authMiddleware],
  request: { params: z.object({ assignmentId: z.string().uuid() }) },
  responses: { 200: { description: 'Submissions', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

assignmentRoutes.openapi(listSubmissionsRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { assignmentId } = c.req.valid('param');

  const ctx = await getAssignmentContext(assignmentId);
  if (!ctx) return c.json({ error: 'Assignment tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const submissions = await db.select({
    id: assignmentSubmissions.id,
    userId: assignmentSubmissions.userId,
    fileUrl: assignmentSubmissions.fileUrl,
    fileName: assignmentSubmissions.fileName,
    fileSizeBytes: assignmentSubmissions.fileSizeBytes,
    notes: assignmentSubmissions.notes,
    status: assignmentSubmissions.status,
    score: assignmentSubmissions.score,
    feedback: assignmentSubmissions.feedback,
    gradedAt: assignmentSubmissions.gradedAt,
    submittedAt: assignmentSubmissions.submittedAt,
    userName: users.name,
    userEmail: users.email,
  })
    .from(assignmentSubmissions)
    .innerJoin(users, eq(assignmentSubmissions.userId, users.id))
    .where(eq(assignmentSubmissions.assignmentId, assignmentId))
    .orderBy(desc(assignmentSubmissions.submittedAt));

  return c.json({ submissions }, 200);
});

// ============================================================
// GET /:assignmentId/my-submission — Submission sendiri (student)
// ============================================================
const mySubmissionRoute = createRoute({
  method: 'get',
  path: '/{assignmentId}/my-submission',
  middleware: [authMiddleware],
  request: { params: z.object({ assignmentId: z.string().uuid() }) },
  responses: { 200: { description: 'My submission', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

assignmentRoutes.openapi(mySubmissionRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { assignmentId } = c.req.valid('param');

  const ctx = await getAssignmentContext(assignmentId);
  if (!ctx) return c.json({ error: 'Assignment tidak ditemukan' }, 404);

  const hasAccess = canManage(ctx.course, payload) || (await isEnrolled(payload.id, ctx.course.id));
  if (!hasAccess) return c.json({ error: 'Anda harus enrolled untuk mengakses assignment ini' }, 403);

  const [submission] = await db.select().from(assignmentSubmissions)
    .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.userId, payload.id)))
    .limit(1);

  return c.json({ submission: submission || null }, 200);
});

// ============================================================
// PUT /submissions/:submissionId/grade — Grading (teacher/admin)
// ============================================================
const GradeSchema = z.object({
  score: z.number().min(0).max(1000),
  feedback: z.string().max(2000).optional(),
});

const gradeSubmissionRoute = createRoute({
  method: 'put',
  path: '/submissions/{submissionId}/grade',
  middleware: [authMiddleware],
  request: {
    params: z.object({ submissionId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: GradeSchema } } },
  },
  responses: { 200: { description: 'Graded', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

assignmentRoutes.openapi(gradeSubmissionRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { submissionId } = c.req.valid('param');
  const body = c.req.valid('json');

  const [submission] = await db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.id, submissionId)).limit(1);
  if (!submission) return c.json({ error: 'Submission tidak ditemukan' }, 404);

  const ctx = await getAssignmentContext(submission.assignmentId);
  if (!ctx) return c.json({ error: 'Assignment tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [row] = await db.update(assignmentSubmissions).set({
    score: body.score,
    feedback: body.feedback || null,
    status: 'graded',
    gradedById: payload.id,
    gradedAt: new Date(),
  }).where(eq(assignmentSubmissions.id, submissionId)).returning();

  // Recalculate course grade and trigger sync to SIDIQ
  void recalculateProgress(submission.userId, ctx.course.id).catch(
    (e) => console.error('[assignment] recalculate error:', e)
  );

  // Email notifikasi ke student (fire-and-forget)
  const [student] = await db.select().from(users).where(eq(users.id, submission.userId)).limit(1);
  if (student) {
    void sendAssignmentGraded(student.email, student.name, ctx.course.title, body.score ?? null).catch(
      (e) => console.error('[email] assignment:', e)
    );
  }

  return c.json(row as any, 200);
});

export default assignmentRoutes;
