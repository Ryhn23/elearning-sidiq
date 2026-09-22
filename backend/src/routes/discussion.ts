import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import {
  courses, courseSections, lessons, discussions, discussionReplies, notifications, users, enrollments,
} from '../db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/jwt';

const discussionRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string; email: string; name: string };

// ============================================================
// HELPERS
// ============================================================

async function getCourseContext(courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  return course || null;
}

function canManageCourse(course: any, payload: JwtPayload): boolean {
  return payload.role === 'admin' || course.instructorId === payload.id;
}

async function isEnrolled(userId: string, courseId: string) {
  const [row] = await db.select({ id: enrollments.id }).from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return !!row;
}

/** Akses diskusi: enrolled / owner / admin */
async function hasCourseAccess(courseId: string, payload: JwtPayload): Promise<boolean> {
  const course = await getCourseContext(courseId);
  if (!course) return false;
  return canManageCourse(course, payload) || (await isEnrolled(payload.id, courseId));
}

// ============================================================
// GET /courses/:courseId — List thread per kursus
// ============================================================
const listByCourseRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}',
  middleware: [authMiddleware],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  responses: { 200: { description: 'Threads', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

discussionRoutes.openapi(listByCourseRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');

  if (!(await hasCourseAccess(courseId, payload))) return c.json({ error: 'Anda harus enrolled untuk mengakses diskusi ini' }, 403);

  const threads = await db.select({
    id: discussions.id,
    title: discussions.title,
    body: discussions.body,
    isPinned: discussions.isPinned,
    replyCount: discussions.replyCount,
    createdAt: discussions.createdAt,
    updatedAt: discussions.updatedAt,
    lessonId: discussions.lessonId,
    authorName: users.name,
  })
    .from(discussions)
    .innerJoin(users, eq(discussions.userId, users.id))
    .where(eq(discussions.courseId, courseId))
    .orderBy(desc(discussions.isPinned), desc(discussions.createdAt));

  return c.json({ threads }, 200);
});

// ============================================================
// GET /lessons/:lessonId — Thread per lesson
// ============================================================
const listByLessonRoute = createRoute({
  method: 'get',
  path: '/lessons/{lessonId}',
  middleware: [authMiddleware],
  request: { params: z.object({ lessonId: z.string().uuid() }) },
  responses: { 200: { description: 'Threads', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

discussionRoutes.openapi(listByLessonRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { lessonId } = c.req.valid('param');

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson) return c.json({ error: 'Lesson tidak ditemukan' }, 404);

  // Ambil courseId via section
  const [sec] = await db.select().from(courseSections).where(eq(courseSections.id, lesson.sectionId)).limit(1);
  if (!sec) return c.json({ error: 'Konteks kursus tidak ditemukan' }, 404);

  if (!(await hasCourseAccess(sec.courseId, payload))) {
    return c.json({ error: 'Anda harus enrolled untuk mengakses diskusi ini' }, 403);
  }

  const threads = await db.select({
    id: discussions.id,
    title: discussions.title,
    body: discussions.body,
    isPinned: discussions.isPinned,
    replyCount: discussions.replyCount,
    createdAt: discussions.createdAt,
    updatedAt: discussions.updatedAt,
    authorName: users.name,
  })
    .from(discussions)
    .innerJoin(users, eq(discussions.userId, users.id))
    .where(and(eq(discussions.courseId, sec.courseId), eq(discussions.lessonId, lessonId)))
    .orderBy(desc(discussions.isPinned), desc(discussions.createdAt));

  return c.json({ threads }, 200);
});

// ============================================================
// POST /courses/:courseId — Buat thread
// ============================================================
const CreateThreadSchema = z.object({
  title: z.string().min(3).max(255),
  body: z.string().min(1).max(5000),
  lessonId: z.string().uuid().optional(),
});

const createThreadRoute = createRoute({
  method: 'post',
  path: '/courses/{courseId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ courseId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: CreateThreadSchema } } },
  },
  responses: { 201: { description: 'Created', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

discussionRoutes.openapi(createThreadRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');
  const body = c.req.valid('json');

  if (!(await hasCourseAccess(courseId, payload))) return c.json({ error: 'Anda harus enrolled untuk membuat thread' }, 403);

  // Jika lessonId diberikan, pastikan lesson milik kursus ini
  let lessonId: string | null = null;
  if (body.lessonId) {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, body.lessonId)).limit(1);
    if (!lesson) return c.json({ error: 'Lesson tidak ditemukan' }, 404);
    lessonId = lesson.id;
  }

  const [thread] = await db.insert(discussions).values({
    courseId,
    lessonId,
    userId: payload.id,
    title: body.title,
    body: body.body,
  }).returning();

  return c.json(thread as any, 201);
});

// ============================================================
// GET /:discussionId — Detail thread + replies
// ============================================================
const getThreadRoute = createRoute({
  method: 'get',
  path: '/{discussionId}',
  middleware: [authMiddleware],
  request: { params: z.object({ discussionId: z.string().uuid() }) },
  responses: { 200: { description: 'Thread detail', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

discussionRoutes.openapi(getThreadRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { discussionId } = c.req.valid('param');

  const [thread] = await db.select().from(discussions).where(eq(discussions.id, discussionId)).limit(1);
  if (!thread) return c.json({ error: 'Thread tidak ditemukan' }, 404);

  if (!(await hasCourseAccess(thread.courseId, payload))) {
    return c.json({ error: 'Anda harus enrolled untuk mengakses thread ini' }, 403);
  }

  const replies = await db.select({
    id: discussionReplies.id,
    body: discussionReplies.body,
    createdAt: discussionReplies.createdAt,
    authorName: users.name,
  })
    .from(discussionReplies)
    .innerJoin(users, eq(discussionReplies.userId, users.id))
    .where(eq(discussionReplies.discussionId, discussionId))
    .orderBy(desc(discussionReplies.createdAt));

  return c.json({ thread, replies }, 200);
});

// ============================================================
// POST /:discussionId/replies — Balas thread
// ============================================================
const CreateReplySchema = z.object({
  body: z.string().min(1).max(5000),
});

const createReplyRoute = createRoute({
  method: 'post',
  path: '/{discussionId}/replies',
  middleware: [authMiddleware],
  request: {
    params: z.object({ discussionId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: CreateReplySchema } } },
  },
  responses: { 201: { description: 'Created', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

discussionRoutes.openapi(createReplyRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { discussionId } = c.req.valid('param');
  const body = c.req.valid('json');

  const [thread] = await db.select().from(discussions).where(eq(discussions.id, discussionId)).limit(1);
  if (!thread) return c.json({ error: 'Thread tidak ditemukan' }, 404);

  if (!(await hasCourseAccess(thread.courseId, payload))) {
    return c.json({ error: 'Anda harus enrolled untuk membalas thread ini' }, 403);
  }

  const [reply] = await db.insert(discussionReplies).values({
    discussionId,
    userId: payload.id,
    body: body.body,
  }).returning();

  // Increment reply count
  await db.update(discussions)
    .set({ replyCount: sql`reply_count + 1`, updatedAt: new Date() })
    .where(eq(discussions.id, discussionId));

  // Notifikasi ke pembuat thread (jika bukan diri sendiri)
  if (thread.userId !== payload.id) {
    await db.insert(notifications).values({
      userId: thread.userId,
      type: 'discussion_reply',
      title: 'Balasan baru di diskusi Anda',
      body: `${payload.name} membalas thread "${thread.title}"`,
      link: `/courses/${thread.courseId}/discussions/${discussionId}`,
    });
  }

  return c.json(reply as any, 201);
});

// ============================================================
// PUT /:discussionId — Edit thread (author/admin)
// ============================================================
const UpdateThreadSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  body: z.string().min(1).max(5000).optional(),
});

const updateThreadRoute = createRoute({
  method: 'put',
  path: '/{discussionId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ discussionId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateThreadSchema } } },
  },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

discussionRoutes.openapi(updateThreadRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { discussionId } = c.req.valid('param');
  const body = c.req.valid('json');

  const [thread] = await db.select().from(discussions).where(eq(discussions.id, discussionId)).limit(1);
  if (!thread) return c.json({ error: 'Thread tidak ditemukan' }, 404);

  const isAuthor = thread.userId === payload.id;
  if (!isAuthor && payload.role !== 'admin') {
    return c.json({ error: 'Hanya pembuat thread atau admin yang dapat mengedit' }, 403);
  }

  const values: Record<string, unknown> = {};
  if (body.title) values.title = body.title;
  if (body.body) values.body = body.body;
  values.updatedAt = new Date();

  const [row] = await db.update(discussions).set(values as any).where(eq(discussions.id, discussionId)).returning();
  return c.json(row as any, 200);
});

// ============================================================
// DELETE /:discussionId — Hapus thread (author/teacher/admin)
// ============================================================
const deleteThreadRoute = createRoute({
  method: 'delete',
  path: '/{discussionId}',
  middleware: [authMiddleware],
  request: { params: z.object({ discussionId: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

discussionRoutes.openapi(deleteThreadRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { discussionId } = c.req.valid('param');

  const [thread] = await db.select().from(discussions).where(eq(discussions.id, discussionId)).limit(1);
  if (!thread) return c.json({ error: 'Thread tidak ditemukan' }, 404);

  const course = await getCourseContext(thread.courseId);
  const isAuthor = thread.userId === payload.id;
  const canDelete = isAuthor || (course && canManageCourse(course, payload));
  if (!canDelete) return c.json({ error: 'Anda tidak memiliki izin untuk menghapus thread ini' }, 403);

  await db.delete(discussions).where(eq(discussions.id, discussionId));
  return c.body(null, 204);
});

// ============================================================
// PATCH /:discussionId/pin — Pin/unpin (teacher/admin)
// ============================================================
const pinThreadRoute = createRoute({
  method: 'patch',
  path: '/{discussionId}/pin',
  middleware: [authMiddleware],
  request: { params: z.object({ discussionId: z.string().uuid() }) },
  responses: { 200: { description: 'Pinned/Unpinned', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

discussionRoutes.openapi(pinThreadRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { discussionId } = c.req.valid('param');

  const [thread] = await db.select().from(discussions).where(eq(discussions.id, discussionId)).limit(1);
  if (!thread) return c.json({ error: 'Thread tidak ditemukan' }, 404);

  const course = await getCourseContext(thread.courseId);
  if (!course || !canManageCourse(course, payload)) {
    return c.json({ error: 'Hanya pengajar atau admin yang dapat mem-pin thread' }, 403);
  }

  const [row] = await db.update(discussions)
    .set({ isPinned: !thread.isPinned, updatedAt: new Date() })
    .where(eq(discussions.id, discussionId)).returning();

  return c.json(row as any, 200);
});

export default discussionRoutes;
