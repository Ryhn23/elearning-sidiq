import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import { courses, courseSections, lessons, lessonContents, enrollments, lessonProgress } from '../db/schema';
import { eq, and, asc, count, inArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/jwt';
import { recalculateProgress } from '../services/progress';
import { sanitizeHtml } from '../lib/sanitize';

const lessonRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string; email: string; name: string };

async function getLessonContext(sectionId: string) {
  const [section] = await db.select().from(courseSections).where(eq(courseSections.id, sectionId)).limit(1);
  if (!section) return null;
  const [course] = await db.select().from(courses).where(eq(courses.id, section.courseId)).limit(1);
  if (!course) return null;
  return { section, course };
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

// POST / — Buat lesson (owner/admin)
const CreateLessonSchema = z.object({
  title: z.string().min(1).max(255),
  type: z.enum(['video', 'document', 'text', 'zoom_link', 'assignment', 'quiz']),
  sortOrder: z.number().int().min(0).optional(),
  isVisible: z.boolean().default(true),
  isFreePreview: z.boolean().default(false),
  durationMinutes: z.number().int().min(0).optional(),
});

const createLessonRoute = createRoute({
  method: 'post',
  path: '/',
  middleware: [authMiddleware],
  request: { body: { content: { 'application/json': { schema: CreateLessonSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

lessonRoutes.openapi(createLessonRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { sectionId } = c.req.param() as any;
  const body = c.req.valid('json');

  const ctx = await getLessonContext(sectionId);
  if (!ctx) return c.json({ error: 'Section tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [lastRow] = await db.select({ value: count() }).from(lessons).where(eq(lessons.sectionId, sectionId));
  const sortOrder = body.sortOrder ?? (lastRow?.value ?? 0);

  const [row] = await db.insert(lessons).values({
    sectionId,
    title: body.title,
    type: body.type,
    sortOrder,
    isVisible: body.isVisible,
    isFreePreview: body.isFreePreview,
    durationMinutes: body.durationMinutes,
  }).returning();

  // Buat lesson_contents kosong (relasi 1-1)
  await db.insert(lessonContents).values({ lessonId: row.id });

  return c.json(row as any, 201);
});

// GET /:lessonId — Get lesson + konten (enrolled/owner/admin)
const getRoute = createRoute({
  method: 'get',
  path: '/{lessonId}',
  middleware: [authMiddleware],
  request: { params: z.object({ sectionId: z.string().uuid(), lessonId: z.string().uuid() }) },
  responses: {
    200: { description: 'Lesson with content', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

lessonRoutes.openapi(getRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { sectionId, lessonId } = c.req.valid('param');

  const ctx = await getLessonContext(sectionId);
  if (!ctx) return c.json({ error: 'Section tidak ditemukan' }, 404);

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson || lesson.sectionId !== sectionId) return c.json({ error: 'Lesson tidak ditemukan' }, 404);

  const hasAccess = payload.role === 'admin' || ctx.course.instructorId === payload.id || (await isEnrolled(payload.id, ctx.course.id));
  if (!hasAccess) return c.json({ error: 'Anda harus enrolled untuk mengakses lesson ini' }, 403);

  const [content] = await db.select().from(lessonContents).where(eq(lessonContents.lessonId, lessonId)).limit(1);
  const [progress] = await db.select().from(lessonProgress)
    .where(and(eq(lessonProgress.userId, payload.id), eq(lessonProgress.lessonId, lessonId)))
    .limit(1);

  return c.json({ lesson: { ...lesson }, content: content ?? null, progress: progress ?? null }, 200);
});

// PUT /:lessonId — Edit metadata (owner/admin)
const UpdateLessonSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: z.enum(['video', 'document', 'text', 'zoom_link', 'assignment', 'quiz']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
  isFreePreview: z.boolean().optional(),
  durationMinutes: z.number().int().min(0).nullable().optional(),
});

const updateRoute = createRoute({
  method: 'put',
  path: '/{lessonId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ sectionId: z.string().uuid(), lessonId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateLessonSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

lessonRoutes.openapi(updateRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { sectionId, lessonId } = c.req.valid('param');
  const body = c.req.valid('json');

  const ctx = await getLessonContext(sectionId);
  if (!ctx) return c.json({ error: 'Section tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [row] = await db.update(lessons).set(body).where(eq(lessons.id, lessonId)).returning();
  if (!row) return c.json({ error: 'Lesson tidak ditemukan' }, 404);
  return c.json(row as any, 200);
});

// PUT /:lessonId/content — Update konten (owner/admin)
const ContentSchema = z.object({
  // video
  videoUrl: z.string().url().optional().or(z.literal('')),
  videoDurationSec: z.number().int().min(0).optional(),
  videoSizeBytes: z.number().int().min(0).optional(),
  // document
  documentUrl: z.string().url().optional().or(z.literal('')),
  documentName: z.string().max(255).optional(),
  documentSizeBytes: z.number().int().min(0).optional(),
  // text
  textContent: z.string().optional(),
  // zoom_link
  zoomUrl: z.string().url().optional().or(z.literal('')),
  zoomMeetingId: z.string().max(100).optional(),
  zoomStartAt: z.string().datetime().nullable().optional(),
  zoomDurationMin: z.number().int().min(0).optional(),
  // assignment
  assignmentInstructions: z.string().optional(),
});

const updateContentRoute = createRoute({
  method: 'put',
  path: '/{lessonId}/content',
  middleware: [authMiddleware],
  request: {
    params: z.object({ sectionId: z.string().uuid(), lessonId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: ContentSchema } } },
  },
  responses: {
    200: { description: 'Content updated', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

lessonRoutes.openapi(updateContentRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { sectionId, lessonId } = c.req.valid('param');
  const body = c.req.valid('json');

  const ctx = await getLessonContext(sectionId);
  if (!ctx) return c.json({ error: 'Section tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson) return c.json({ error: 'Lesson tidak ditemukan' }, 404);

  // Normalisasi: buang key undefined + konversi zoomStartAt string → Date
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    values[k] = k === 'zoomStartAt' && v ? new Date(v) : v;
  }

  // Sanitasi rich text HTML sebelum simpan ke DB
  if (typeof values.textContent === 'string') values.textContent = sanitizeHtml(values.textContent);
  if (typeof values.assignmentInstructions === 'string') {
    values.assignmentInstructions = sanitizeHtml(values.assignmentInstructions as string);
  }

  const [existing] = await db.select().from(lessonContents).where(eq(lessonContents.lessonId, lessonId)).limit(1);
  if (existing) {
    const [row] = await db.update(lessonContents).set(values as any).where(eq(lessonContents.id, existing.id)).returning();
    return c.json(row as any, 200);
  }

  const [row] = await db.insert(lessonContents).values({ lessonId, ...values } as any).returning();
  return c.json(row as any, 200);
});

// DELETE /:lessonId — Hapus (owner/admin)
const deleteRoute = createRoute({
  method: 'delete',
  path: '/{lessonId}',
  middleware: [authMiddleware],
  request: { params: z.object({ sectionId: z.string().uuid(), lessonId: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

lessonRoutes.openapi(deleteRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { sectionId, lessonId } = c.req.valid('param');

  const ctx = await getLessonContext(sectionId);
  if (!ctx) return c.json({ error: 'Section tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [row] = await db.delete(lessons).where(eq(lessons.id, lessonId)).returning({ id: lessons.id });
  if (!row) return c.json({ error: 'Lesson tidak ditemukan' }, 404);
  return c.body(null, 204);
});

// PATCH /reorder — Ubah urutan lesson dalam section (owner/admin)
const ReorderSchema = z.object({ order: z.array(z.string().uuid()).min(1) });

const reorderRoute = createRoute({
  method: 'patch',
  path: '/reorder',
  middleware: [authMiddleware],
  request: {
    params: z.object({ sectionId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: ReorderSchema } } },
  },
  responses: { 200: { description: 'Reordered' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

lessonRoutes.openapi(reorderRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { sectionId } = c.req.valid('param');
  const body = c.req.valid('json');

  const ctx = await getLessonContext(sectionId);
  if (!ctx) return c.json({ error: 'Section tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  for (let i = 0; i < body.order.length; i++) {
    await db.update(lessons).set({ sortOrder: i }).where(eq(lessons.id, body.order[i]));
  }

  return c.json({ message: 'Urutan lesson diperbarui' }, 200);
});

// POST /:lessonId/complete — Tandai lesson selesai (enrolled)
const completeRoute = createRoute({
  method: 'post',
  path: '/{lessonId}/complete',
  middleware: [authMiddleware],
  request: { params: z.object({ sectionId: z.string().uuid(), lessonId: z.string().uuid() }) },
  responses: { 200: { description: 'Completed' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

lessonRoutes.openapi(completeRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { sectionId, lessonId } = c.req.valid('param');

  const ctx = await getLessonContext(sectionId);
  if (!ctx) return c.json({ error: 'Section tidak ditemukan' }, 404);

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson || lesson.sectionId !== sectionId) return c.json({ error: 'Lesson tidak ditemukan' }, 404);

  const enrolled = payload.role === 'admin' || ctx.course.instructorId === payload.id || (await isEnrolled(payload.id, ctx.course.id));
  if (!enrolled) return c.json({ error: 'Anda harus enrolled untuk mengakses lesson ini' }, 403);

  await db.insert(lessonProgress).values({
    userId: payload.id,
    lessonId,
    courseId: ctx.course.id,
    isCompleted: true,
    completedAt: new Date(),
    lastAccessAt: new Date(),
  }).onConflictDoUpdate({
    target: [lessonProgress.userId, lessonProgress.lessonId],
    set: { isCompleted: true, completedAt: new Date(), lastAccessAt: new Date() },
  });

  await recalculateProgress(payload.id, ctx.course.id);

  return c.json({ message: 'Lesson ditandai selesai' }, 200);
});

// DELETE /:lessonId/complete — Batalkan completion (enrolled)
const uncompleteRoute = createRoute({
  method: 'delete',
  path: '/{lessonId}/complete',
  middleware: [authMiddleware],
  request: { params: z.object({ sectionId: z.string().uuid(), lessonId: z.string().uuid() }) },
  responses: { 200: { description: 'Uncompleted' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

lessonRoutes.openapi(uncompleteRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { sectionId, lessonId } = c.req.valid('param');

  const ctx = await getLessonContext(sectionId);
  if (!ctx) return c.json({ error: 'Section tidak ditemukan' }, 404);

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson || lesson.sectionId !== sectionId) return c.json({ error: 'Lesson tidak ditemukan' }, 404);

  const enrolled = payload.role === 'admin' || ctx.course.instructorId === payload.id || (await isEnrolled(payload.id, ctx.course.id));
  if (!enrolled) return c.json({ error: 'Anda harus enrolled untuk mengakses lesson ini' }, 403);

  await db.update(lessonProgress).set({ isCompleted: false, completedAt: null }).where(
    and(eq(lessonProgress.userId, payload.id), eq(lessonProgress.lessonId, lessonId))
  );

  await recalculateProgress(payload.id, ctx.course.id);

  return c.json({ message: 'Completion dibatalkan' }, 200);
});

// PATCH /:lessonId/video-position — Simpan posisi video (enrolled)
const VideoPositionSchema = z.object({ positionSec: z.number().int().min(0) });

const videoPositionRoute = createRoute({
  method: 'patch',
  path: '/{lessonId}/video-position',
  middleware: [authMiddleware],
  request: {
    params: z.object({ sectionId: z.string().uuid(), lessonId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: VideoPositionSchema } } },
  },
  responses: { 200: { description: 'Position saved' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

lessonRoutes.openapi(videoPositionRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { sectionId, lessonId } = c.req.valid('param');
  const body = c.req.valid('json');

  const ctx = await getLessonContext(sectionId);
  if (!ctx) return c.json({ error: 'Section tidak ditemukan' }, 404);

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson || lesson.sectionId !== sectionId) return c.json({ error: 'Lesson tidak ditemukan' }, 404);

  const enrolled = payload.role === 'admin' || ctx.course.instructorId === payload.id || (await isEnrolled(payload.id, ctx.course.id));
  if (!enrolled) return c.json({ error: 'Anda harus enrolled untuk mengakses lesson ini' }, 403);

  await db.insert(lessonProgress).values({
    userId: payload.id,
    lessonId,
    courseId: ctx.course.id,
    isCompleted: false,
    videoPosition: body.positionSec,
    lastAccessAt: new Date(),
  }).onConflictDoUpdate({
    target: [lessonProgress.userId, lessonProgress.lessonId],
    set: { videoPosition: body.positionSec, lastAccessAt: new Date() },
  });

  return c.json({ message: 'Posisi video disimpan' }, 200);
});

export default lessonRoutes;
