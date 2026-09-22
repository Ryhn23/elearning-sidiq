import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import { categories } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware, roleMiddleware } from '../middleware/jwt';

const categoryRoutes = new OpenAPIHono();

const CategoryOutSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  iconUrl: z.string().nullable(),
  sortOrder: z.number(),
});

// GET / — list semua kategori (public)
const listRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: { description: 'List categories', content: { 'application/json': { schema: z.array(CategoryOutSchema) } } },
  },
});

categoryRoutes.openapi(listRoute, async (c) => {
  const rows = await db.select().from(categories).orderBy(categories.sortOrder);
  return c.json(rows as any, 200);
});

const CategoryBodySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'slug harus lowercase huruf/angka/hyphen'),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional().or(z.literal('')),
  sortOrder: z.number().int().min(0).optional(),
});

// POST / — buat kategori (admin)
const createCategoryRoute = createRoute({
  method: 'post',
  path: '/',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { body: { content: { 'application/json': { schema: CategoryBodySchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: CategoryOutSchema } } },
    400: { description: 'Bad Request' },
    409: { description: 'Conflict' },
  },
});

categoryRoutes.openapi(createCategoryRoute, async (c) => {
  const body = c.req.valid('json');

  const [existing] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, body.slug)).limit(1);
  if (existing) return c.json({ error: 'Slug kategori sudah digunakan' }, 409);

  const [row] = await db.insert(categories).values({
    name: body.name,
    slug: body.slug,
    description: body.description,
    iconUrl: body.iconUrl || null,
    sortOrder: body.sortOrder ?? 0,
  }).returning();

  return c.json(row as any, 201);
});

const CategoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional().or(z.literal('')),
  sortOrder: z.number().int().min(0).optional(),
});

// PUT /:id — edit kategori (admin)
const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: CategoryUpdateSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: CategoryOutSchema } } },
    404: { description: 'Not Found' },
  },
});

categoryRoutes.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');

  const [row] = await db.update(categories).set({ ...body }).where(eq(categories.id, id)).returning();
  if (!row) return c.json({ error: 'Kategori tidak ditemukan' }, 404);
  return c.json(row as any, 200);
});

// DELETE /:id — hapus kategori (admin)
const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'Deleted' },
    404: { description: 'Not Found' },
  },
});

categoryRoutes.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid('param');
  const [row] = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
  if (!row) return c.json({ error: 'Kategori tidak ditemukan' }, 404);
  return c.body(null, 204);
});

export default categoryRoutes;
