import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import { certificates, courses, users, enrollments } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/jwt';
import { generateCertificate, verifyCertificate } from '../services/certificate';
import { sendCertificateIssued } from '../services/email';

const certificateRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string; email: string; name: string };

// ============================================================
// GET /my — Sertifikat milik user (auth)
// ============================================================
const myCertificatesRoute = createRoute({
  method: 'get',
  path: '/my',
  middleware: [authMiddleware],
  responses: { 200: { description: 'My certificates', content: { 'application/json': { schema: z.any() } } } },
});

certificateRoutes.openapi(myCertificatesRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;

  const certs = await db.select({
    id: certificates.id,
    code: certificates.code,
    pdfUrl: certificates.pdfUrl,
    issuedAt: certificates.issuedAt,
    courseId: certificates.courseId,
    courseTitle: courses.title,
    instructorName: users.name,
  })
    .from(certificates)
    .innerJoin(courses, eq(certificates.courseId, courses.id))
    .leftJoin(users, eq(courses.instructorId, users.id))
    .where(eq(certificates.userId, payload.id))
    .orderBy(desc(certificates.issuedAt));

  return c.json({ certificates: certs }, 200);
});

// ============================================================
// POST /courses/:courseId/generate — Generate manual (auth)
// Syarat: enrolled + progress 100%
// ============================================================
const generateRoute = createRoute({
  method: 'post',
  path: '/courses/{courseId}/generate',
  middleware: [authMiddleware],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  responses: {
    200: { description: 'Certificate', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

certificateRoutes.openapi(generateRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { courseId } = c.req.valid('param');

  const [enrollment] = await db.select().from(enrollments)
    .where(and(eq(enrollments.userId, payload.id), eq(enrollments.courseId, courseId)))
    .limit(1);
  if (!enrollment) return c.json({ error: 'Anda belum terdaftar di kursus ini' }, 403);

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);

  if ((enrollment.progress ?? 0) < 100) {
    return c.json({ error: `Sertifikat hanya tersedia setelah kursus selesai (progress saat ini ${Math.round(enrollment.progress ?? 0)}%)` }, 403);
  }

  const cert = await generateCertificate(payload.id, courseId);

  // Email notifikasi (hanya jika baru diterbitkan, hindari duplikat saat regenerate)
  if (Date.now() - new Date((cert as any).issuedAt).getTime() < 10_000) {
    void sendCertificateIssued(payload.email, payload.name, course.title, (cert as any).code).catch(
      (e) => console.error('[email] certificate:', e)
    );
  }

  return c.json(cert as any, 200);
});

// ============================================================
// GET /:code — Verifikasi publik (tanpa auth)
// ============================================================
const verifyRoute = createRoute({
  method: 'get',
  path: '/{code}',
  request: { params: z.object({ code: z.string().min(6).max(50) }) },
  responses: {
    200: { description: 'Verification result', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Not Found' },
  },
});

certificateRoutes.openapi(verifyRoute, async (c) => {
  const { code } = c.req.valid('param');
  const result = await verifyCertificate(code);
  if (!result) return c.json({ valid: false, message: 'Sertifikat tidak ditemukan' }, 404);
  return c.json(result, 200);
});

export default certificateRoutes;
