import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import { notifications } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/jwt';

const notificationRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string; email: string; name: string };

// ============================================================
// GET / — List notifikasi (max 50 terbaru)
// ============================================================
const listRoute = createRoute({
  method: 'get',
  path: '/',
  middleware: [authMiddleware],
  responses: { 200: { description: 'Notifications', content: { 'application/json': { schema: z.any() } } } },
});

notificationRoutes.openapi(listRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;

  const rows = await db.select().from(notifications)
    .where(eq(notifications.userId, payload.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return c.json({ notifications: rows }, 200);
});

// ============================================================
// GET /unread-count — Jumlah belum dibaca
// ============================================================
const unreadCountRoute = createRoute({
  method: 'get',
  path: '/unread-count',
  middleware: [authMiddleware],
  responses: { 200: { description: 'Unread count', content: { 'application/json': { schema: z.any() } } } },
});

notificationRoutes.openapi(unreadCountRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;

  const [row] = await db.select({ value: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, payload.id), eq(notifications.isRead, false)));

  return c.json({ count: row?.value ?? 0 }, 200);
});

// ============================================================
// PATCH /read-all — Tandai semua dibaca
// ============================================================
const readAllRoute = createRoute({
  method: 'patch',
  path: '/read-all',
  middleware: [authMiddleware],
  responses: { 200: { description: 'OK' } },
});

notificationRoutes.openapi(readAllRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;

  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, payload.id), eq(notifications.isRead, false)));

  return c.json({ message: 'Semua notifikasi ditandai dibaca' }, 200);
});

// ============================================================
// PATCH /:id/read — Tandai 1 sudah dibaca
// ============================================================
const readRoute = createRoute({
  method: 'patch',
  path: '/{id}/read',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'OK' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

notificationRoutes.openapi(readRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { id } = c.req.valid('param');

  const [row] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  if (!row || row.userId !== payload.id) return c.json({ error: 'Notifikasi tidak ditemukan' }, 404);

  const [updated] = await db.update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, id)).returning();

  return c.json(updated as any, 200);
});

// ============================================================
// DELETE /:id — Hapus notifikasi
// ============================================================
const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

notificationRoutes.openapi(deleteRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { id } = c.req.valid('param');

  const [row] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  if (!row || row.userId !== payload.id) return c.json({ error: 'Notifikasi tidak ditemukan' }, 404);

  await db.delete(notifications).where(eq(notifications.id, id));
  return c.body(null, 204);
});

export default notificationRoutes;
