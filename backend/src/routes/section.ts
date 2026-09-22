import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import { courses, courseSections, lessons } from '../db/schema';
import { eq, and, asc, count, inArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/jwt';

const sectionRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string; email: string; name: string };

async function getCourseOr404(courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  return course ?? null;
}

function canManage(course: any, payload: JwtPayload): boolean {
  return payload.role === 'admin' || course.instructorId === payload.id;
}

// GET / — List sections + lesson metadata (tanpa konten)
const listRoute = createRoute({
  method: 'get',
  path: '/',
  middleware: [authMiddleware],
  responses: {
    200: { description: 'Sections with lessons', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Not Found' },
  },
});

sectionRoutes.openapi(listRoute, async (c) => {
  const { courseId } = c.req.param() as any;
  const course = await getCourseOr404(courseId);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);

  const sections = await db.select().from(courseSections).where(eq(courseSections.courseId, courseId)).orderBy(asc(courseSections.sortOrder));
  const sectionIds = sections.map((s) => s.id);

  const lessonRows = sectionIds.length
    ? await db.select().from(lessons)
      .where(and(inArray(lessons.sectionId, sectionIds), eq(lessons.isVisible, true)))
      .orderBy(asc(lessons.sortOrder))
    : [];
  const filtered = lessonRows;

  const sectionsWithLessons = sections.map((s) => ({
    ...s,
    lessons: filtered.filter((l) => l.sectionId === s.id).map(({ sectionId, ...rest }) => rest),
  }));

  return c.json({ data: sectionsWithLessons }, 200);
});

// POST / — Buat section (owner/admin)
const CreateSectionSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isVisible: z.boolean().default(true),
});

const createSectionRoute = createRoute({
  method: 'post',
  path: '/',
  middleware: [authMiddleware],
  request: { body: { content: { 'application/json': { schema: CreateSectionSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

sectionRoutes.openapi(createSectionRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.param() as any;
  const body = c.req.valid('json');

  const course = await getCourseOr404(courseId);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!canManage(course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [lastRow] = await db.select({ value: count() }).from(courseSections).where(eq(courseSections.courseId, courseId));
  const sortOrder = body.sortOrder ?? (lastRow?.value ?? 0);

  const [row] = await db.insert(courseSections).values({
    courseId,
    title: body.title,
    description: body.description,
    sortOrder,
    isVisible: body.isVisible,
  }).returning();

  return c.json(row as any, 201);
});

// PUT /:sectionId — Edit section (owner/admin)
const UpdateSectionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});

const updateRoute = createRoute({
  method: 'put',
  path: '/{sectionId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ courseId: z.string().uuid(), sectionId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateSectionSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

sectionRoutes.openapi(updateRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId, sectionId } = c.req.valid('param');
  const body = c.req.valid('json');

  const course = await getCourseOr404(courseId);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!canManage(course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [row] = await db.update(courseSections).set(body).where(eq(courseSections.id, sectionId)).returning();
  if (!row) return c.json({ error: 'Section tidak ditemukan' }, 404);
  return c.json(row as any, 200);
});

// DELETE /:sectionId — Hapus section + cascade (owner/admin)
const deleteRoute = createRoute({
  method: 'delete',
  path: '/{sectionId}',
  middleware: [authMiddleware],
  request: { params: z.object({ courseId: z.string().uuid(), sectionId: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

sectionRoutes.openapi(deleteRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId, sectionId } = c.req.valid('param');

  const course = await getCourseOr404(courseId);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!canManage(course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [row] = await db.delete(courseSections).where(eq(courseSections.id, sectionId)).returning({ id: courseSections.id });
  if (!row) return c.json({ error: 'Section tidak ditemukan' }, 404);
  return c.body(null, 204);
});

// PATCH /reorder — Ubah urutan { order: [uuid, ...] } (owner/admin)
const ReorderSchema = z.object({ order: z.array(z.string().uuid()).min(1) });

const reorderRoute = createRoute({
  method: 'patch',
  path: '/reorder',
  middleware: [authMiddleware],
  request: {
    params: z.object({ courseId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: ReorderSchema } } },
  },
  responses: { 200: { description: 'Reordered' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

sectionRoutes.openapi(reorderRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');
  const body = c.req.valid('json');

  const course = await getCourseOr404(courseId);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!canManage(course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  for (let i = 0; i < body.order.length; i++) {
    await db.update(courseSections).set({ sortOrder: i }).where(eq(courseSections.id, body.order[i]));
  }

  return c.json({ message: 'Urutan section diperbarui' }, 200);
});

export default sectionRoutes;
