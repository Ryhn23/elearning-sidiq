import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import { courses, announcements, notifications, users, enrollments } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/jwt';

const announcementRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string; email: string; name: string };

async function getCourse(courseId: string) {
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

// ============================================================
// GET /courses/:courseId — List pengumuman (enrolled/owner/admin)
// ============================================================
const listRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}',
  middleware: [authMiddleware],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  responses: { 200: { description: 'Announcements', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

announcementRoutes.openapi(listRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');

  const course = await getCourse(courseId);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!(await isEnrolled(payload.id, courseId)) && !canManageCourse(course, payload)) {
    return c.json({ error: 'Anda harus enrolled untuk melihat pengumuman ini' }, 403);
  }

  const rows = await db.select({
    id: announcements.id,
    isPinned: announcements.isPinned,
    title: announcements.title,
    body: announcements.body,
    createdAt: announcements.createdAt,
    updatedAt: announcements.updatedAt,
    authorName: users.name,
  })
    .from(announcements)
    .innerJoin(users, eq(announcements.authorId, users.id))
    .where(eq(announcements.courseId, courseId))
    .orderBy(desc(announcements.createdAt));

  return c.json({ announcements: rows }, 200);
});

// ============================================================
// POST /courses/:courseId — Buat pengumuman (teacher/admin)
// + notifikasi ke semua student enrolled
// ============================================================
const CreateSchema = z.object({
  title: z.string().min(3).max(255),
  body: z.string().min(1).max(5000),
  isPinned: z.boolean().optional(),
});

const createAnnouncementRoute = createRoute({
  method: 'post',
  path: '/courses/{courseId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ courseId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: CreateSchema } } },
  },
  responses: { 201: { description: 'Created', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

announcementRoutes.openapi(createAnnouncementRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');
  const body = c.req.valid('json');

  const course = await getCourse(courseId);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!canManageCourse(course, payload)) {
    return c.json({ error: 'Hanya pengajar atau admin yang dapat membuat pengumuman' }, 403);
  }

  const [row] = await db.insert(announcements).values({
    courseId,
    authorId: payload.id,
    title: body.title,
    body: body.body,
    isPinned: body.isPinned ?? false,
  }).returning();

  // Notifikasi ke semua student enrolled (kecuali pembuat)
  const students = await db.select({ userId: enrollments.userId })
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.status, 'active')));

  for (const s of students) {
    if (s.userId === payload.id) continue;
    await db.insert(notifications).values({
      userId: s.userId,
      type: 'announcement',
      title: `Pengumuman baru: ${body.title}`,
      body: `${course.title} — ${payload.name}: "${body.body.slice(0, 120)}"`,
      link: `/courses/${(course as any).slug ?? courseId}`,
    });
  }

  return c.json(row as any, 201);
});

// ============================================================
// PUT /:id — Edit (author/admin)
// ============================================================
const UpdateSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  body: z.string().min(1).max(5000).optional(),
  isPinned: z.boolean().optional(),
});

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateSchema } } },
  },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

announcementRoutes.openapi(updateRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');

  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!row) return c.json({ error: 'Pengumuman tidak ditemukan' }, 404);

  const isAuthor = row.authorId === payload.id;
  if (!isAuthor && payload.role !== 'admin') {
    return c.json({ error: 'Hanya pembuat pengumuman atau admin yang dapat mengedit' }, 403);
  }

  const values: Record<string, unknown> = {};
  if (body.title) values.title = body.title;
  if (body.body) values.body = body.body;
  if (body.isPinned !== undefined) values.isPinned = body.isPinned;
  values.updatedAt = new Date();

  const [updated] = await db.update(announcements).set(values as any).where(eq(announcements.id, id)).returning();
  return c.json(updated as any, 200);
});

// ============================================================
// DELETE /:id — Hapus (author/admin)
// ============================================================
const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

announcementRoutes.openapi(deleteRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { id } = c.req.valid('param');

  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!row) return c.json({ error: 'Pengumuman tidak ditemukan' }, 404);

  const isAuthor = row.authorId === payload.id;
  if (!isAuthor && payload.role !== 'admin') {
    return c.json({ error: 'Hanya pembuat pengumuman atau admin yang dapat menghapus' }, 403);
  }

  await db.delete(announcements).where(eq(announcements.id, id));
  return c.body(null, 204);
});

export default announcementRoutes;
