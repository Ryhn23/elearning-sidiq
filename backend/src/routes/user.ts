import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users, enrollments, courses, userSettings } from '../db/schema';
import { eq, and, ilike, count, or, desc } from 'drizzle-orm';
import { authMiddleware, roleMiddleware } from '../middleware/jwt';

const userRoutes = new OpenAPIHono();

// ============================================================
// SETTINGS — GET & PUT /me/settings
// ============================================================

const getSettingsRoute = createRoute({
  method: 'get',
  path: '/me/settings',
  middleware: [authMiddleware],
  responses: { 200: { description: 'User settings', content: { 'application/json': { schema: z.any() } } } },
});

userRoutes.openapi(getSettingsRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as { id: string };
  let [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, payload.id)).limit(1);
  if (!settings) {
    const inserted = await db.insert(userSettings).values({
      userId: payload.id,
      emailNotifications: true,
      language: 'id',
      timezone: 'Asia/Jakarta',
    }).onConflictDoNothing().returning();
    settings = inserted[0];
    if (!settings) {
      [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, payload.id)).limit(1);
    }
  }
  return c.json({ settings }, 200);
});

const UpdateSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  language: z.string().min(2).max(10).optional(),
  timezone: z.string().min(2).max(50).optional(),
});

const updateSettingsRoute = createRoute({
  method: 'put',
  path: '/me/settings',
  middleware: [authMiddleware],
  request: { body: { content: { 'application/json': { schema: UpdateSettingsSchema } } } },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } } },
});

userRoutes.openapi(updateSettingsRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as { id: string };
  const body = c.req.valid('json');

  let [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, payload.id)).limit(1);
  if (!settings) {
    [settings] = await db.insert(userSettings).values({
      userId: payload.id,
      emailNotifications: body.emailNotifications ?? true,
      language: body.language ?? 'id',
      timezone: body.timezone ?? 'Asia/Jakarta',
    }).returning();
  } else {
    [settings] = await db.update(userSettings).set({
      ...body,
      updatedAt: new Date(),
    }).where(eq(userSettings.userId, payload.id)).returning();
  }

  return c.json({ settings }, 200);
});

// ============================================================
// GET / — List semua user (search, filter role, paginated)
// ============================================================
const UserListQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(['student', 'teacher', 'admin']).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const listRoute = createRoute({
  method: 'get',
  path: '/',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { query: UserListQuerySchema },
  responses: { 200: { description: 'Users', content: { 'application/json': { schema: z.any() } } } },
});

userRoutes.openapi(listRoute, async (c) => {
  const q = c.req.valid('query');

  const conditions = [];
  if (q.search) {
    const pattern = `%${q.search}%`;
    conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
  }
  if (q.role) conditions.push(eq(users.role, q.role));
  if (q.isActive !== undefined) conditions.push(eq(users.isActive, q.isActive));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(users).where(where);
  const total = totalRow?.value ?? 0;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(q.limit)
    .offset((q.page - 1) * q.limit);

  return c.json({
    data: rows,
    pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  }, 200);
});

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ============================================================
// GET /export — Export CSV user platform (admin only)
// (Must be defined before /:id to avoid router conflict)
// ============================================================
const exportUsersRoute = createRoute({
  method: 'get',
  path: '/export',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  responses: { 200: { description: 'CSV export' }, 403: { description: 'Forbidden' } },
});

userRoutes.openapi(exportUsersRoute, async () => {
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const headers = ['ID User', 'Nama Lengkap', 'Email', 'Role', 'Status', 'Tanggal Terdaftar', 'Terakhir Login'];
  const lines = [headers.map(escapeCsv).join(',')];

  for (const u of allUsers) {
    lines.push([
      u.id,
      u.name,
      u.email,
      u.role,
      u.isActive ? 'Aktif' : 'Nonaktif',
      u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '-',
      u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().slice(0, 19).replace('T', ' ') : '-',
    ].map(escapeCsv).join(','));
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="users.csv"',
    },
  });
});

// ============================================================
// GET /:id — Detail user
// ============================================================
const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'User detail', content: { 'application/json': { schema: z.any() } } }, 404: { description: 'Not Found' } },
});

userRoutes.openapi(getRoute, async (c) => {
  const { id } = c.req.valid('param');

  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) return c.json({ error: 'User tidak ditemukan' }, 404);

  // Sensitive fields di-strip
  const { passwordHash, ...safe } = row;
  void passwordHash;

  return c.json(safe as any, 200);
});

// ============================================================
// POST / — Buat user manual (admin)
// ============================================================
const CreateUserSchema = z.object({
  name: z.string().min(3).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['student', 'teacher']).default('student'),
});

const createUserRoute = createRoute({
  method: 'post',
  path: '/',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { body: { content: { 'application/json': { schema: CreateUserSchema } } } },
  responses: { 201: { description: 'Created', content: { 'application/json': { schema: z.any() } } }, 409: { description: 'Conflict' } },
});

userRoutes.openapi(createUserRoute, async (c) => {
  const body = c.req.valid('json');

  // Cek email unik
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
  if (existing) return c.json({ error: 'Email sudah terdaftar' }, 409);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(body.password, salt);

  const [row] = await db.insert(users).values({
    name: body.name,
    email: body.email,
    passwordHash,
    role: body.role,
  }).returning();

  const { passwordHash: _ph, ...safe } = row;
  void _ph;
  return c.json(safe as any, 201);
});

// ============================================================
// PUT /:id — Edit user (name, role, bio, phone)
// ============================================================
const UpdateUserSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  role: z.enum(['student', 'teacher', 'admin']).optional(),
  bio: z.string().max(1000).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
});

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateUserSchema } } },
  },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } }, 404: { description: 'Not Found' } },
});

userRoutes.openapi(updateRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as { id: string };
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');

  // Cegah admin menurunkan role dirinya sendiri
  if (id === payload.id && body.role && body.role !== 'admin') {
    return c.json({ error: 'Anda tidak dapat mengubah role akun Anda sendiri' }, 400);
  }

  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return c.json({ error: 'User tidak ditemukan' }, 404);

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) values.name = body.name;
  if (body.role !== undefined) values.role = body.role;
  if (body.bio !== undefined) values.bio = body.bio;
  if (body.phone !== undefined) values.phone = body.phone;

  const [row] = await db.update(users).set(values as any).where(eq(users.id, id)).returning();
  const { passwordHash: _ph, ...safe } = row;
  void _ph;
  return c.json(safe as any, 200);
});

// ============================================================
// PATCH /:id/activate — Aktifkan user
// ============================================================
const activateRoute = createRoute({
  method: 'patch',
  path: '/{id}/activate',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Activated' }, 404: { description: 'Not Found' } },
});

userRoutes.openapi(activateRoute, async (c) => {
  const { id } = c.req.valid('param');

  const [row] = await db.update(users).set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, id)).returning();
  if (!row) return c.json({ error: 'User tidak ditemukan' }, 404);

  const { passwordHash: _ph, ...safe } = row;
  void _ph;
  return c.json(safe as any, 200);
});

// ============================================================
// PATCH /:id/deactivate — Nonaktifkan user
// ============================================================
const deactivateRoute = createRoute({
  method: 'patch',
  path: '/{id}/deactivate',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Deactivated' }, 400: { description: 'Bad Request' }, 404: { description: 'Not Found' } },
});

userRoutes.openapi(deactivateRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as { id: string };
  const { id } = c.req.valid('param');

  if (id === payload.id) return c.json({ error: 'Anda tidak dapat menonaktifkan akun sendiri' }, 400);

  const [row] = await db.update(users).set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, id)).returning();
  if (!row) return c.json({ error: 'User tidak ditemukan' }, 404);

  const { passwordHash: _ph, ...safe } = row;
  void _ph;
  return c.json(safe as any, 200);
});

// ============================================================
// GET /:id/enrollments — Kursus yang diikuti user
// ============================================================
const enrollmentsRoute = createRoute({
  method: 'get',
  path: '/{id}/enrollments',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Enrollments', content: { 'application/json': { schema: z.any() } } }, 404: { description: 'Not Found' } },
});

userRoutes.openapi(enrollmentsRoute, async (c) => {
  const { id } = c.req.valid('param');

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!user) return c.json({ error: 'User tidak ditemukan' }, 404);

  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      status: enrollments.status,
      progress: enrollments.progress,
      enrolledAt: enrollments.enrolledAt,
      completedAt: enrollments.completedAt,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, id))
    .orderBy(desc(enrollments.enrolledAt));

  return c.json({ enrollments: rows }, 200);
});

export default userRoutes;

