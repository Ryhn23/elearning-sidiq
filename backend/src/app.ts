import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { logger } from 'hono/logger';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

import courseRoute from './routes/course';
import authRoute from './routes/auth';
import categoryRoutes from './routes/category';
import sectionRoutes from './routes/section';
import lessonRoutes from './routes/lesson';
import enrollmentRoutes from './routes/enrollment';
import uploadRoutes from './routes/upload';
import quizRoutes from './routes/quizzes';
import assignmentRoutes from './routes/assignments';
import certificateRoutes from './routes/certificates';
import discussionRoutes from './routes/discussion';
import announcementRoutes from './routes/announcement';
import notificationRoutes from './routes/notification';
import userRoutes from './routes/user';
import analyticsRoutes from './routes/analytics';
import sidiqIntegrationRoutes from './routes/sidiqIntegration';
import { ensureUploadDirs, UPLOAD_DIR } from './services/storage';
import { rateLimit } from './middleware/rateLimit';
import { checkDatabase } from './db';

const app = new OpenAPIHono();
const IS_PROD = process.env.NODE_ENV === 'production';

// Global error handler: log server-side, jangan bocorkan detail internal ke klien.
app.onError((err, c) => {
  // Error 4xx dari middleware (mis. BodySizeError 413 dari bodyLimit):
  // kembalikan status aslinya — ini error sisi klien, aman untuk diekspos.
  const status = (err as { status?: number }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const message = err.message || (status === 413 ? 'Payload too large' : 'Error');
    return c.json({ error: message }, status as 400);
  }
  console.error(`[error] ${c.req.method} ${c.req.path}:`, err);
  if (IS_PROD) {
    return c.json({ error: 'Terjadi kesalahan pada server. Silakan coba lagi.' }, 500);
  }
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

// Header keamanan dasar di semua respons (dev server tidak punya nginx).
// CSP/Permissions-Policy lengkap ada di nginx.conf (batas produksi).
app.use('*', (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  return next();
});

// CORS: hanya origin frontend yang diizinkan (bukan wildcard).
const FRONTEND_ORIGIN = process.env.APP_URL || 'http://localhost:5174';
function isAllowedOrigin(origin: string): boolean {
  if (origin === FRONTEND_ORIGIN) return true;
  try {
    const u = new URL(origin);
    return (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      (u.port === '5174' || u.port === '8080')
    );
  } catch {
    return false;
  }
}

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : null),
  })
);

// Rate limit per IP (kecuali saat testing NODE_ENV === 'test')
if (process.env.NODE_ENV !== 'test') {
  // Aturan spesifik keamanan auth (06-security.md)
  app.use('/api/v1/auth/login', rateLimit({ limit: 5, windowMs: 15 * 60 * 1000, name: 'auth-login' }));
  app.use('/api/v1/auth/register', rateLimit({ limit: 3, windowMs: 60 * 60 * 1000, name: 'auth-register' }));
  app.use('/api/v1/auth/forgot-password', rateLimit({ limit: 3, windowMs: 60 * 60 * 1000, name: 'auth-forgot' }));

  // Upload limits: 10x / menit
  app.use('/api/v1/upload/*', rateLimit({ limit: 10, windowMs: 60 * 1000, name: 'upload' }));

  // Rate limit umum API: 100x / menit per IP
  const apiRateLimit = rateLimit({ limit: 100, windowMs: 60 * 1000, name: 'api' });
  app.use('/api/v1/*', (c, next) => {
    if (
      c.req.path.startsWith('/api/v1/upload') ||
      c.req.path === '/api/v1/auth/login' ||
      c.req.path === '/api/v1/auth/register' ||
      c.req.path === '/api/v1/auth/forgot-password'
    ) {
      return next();
    }
    return apiRateLimit(c, next);
  });
}

// Batasi ukuran body JSON API (1MB) agar tidak bisa disetel payload raksasa.
// Upload dikecualikan: butuh body besar dan punya parser multipart sendiri + limit di nginx.
const jsonBodyLimit = bodyLimit({ maxSize: 1024 * 1024 });
app.use('/api/v1/*', (c, next) => {
  if (c.req.path.startsWith('/api/v1/upload')) return next();
  return jsonBodyLimit(c, next);
});

// Swagger Documentation — hanya di luar produksi (jangan bocorkan dokumentasi API publik)
if (!IS_PROD) {
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'E-Learning API',
      description: 'API for E-Learning Platform',
    },
  });
  app.get('/ui', swaggerUI({ url: '/doc' }));
}

// Routes
app.route('/api/v1/auth', authRoute);
app.route('/api/v1/categories', categoryRoutes);
app.route('/api/v1/courses', courseRoute);
app.route('/api/v1/courses/:courseId/sections', sectionRoutes);
app.route('/api/v1/sections/:sectionId/lessons', lessonRoutes);
app.route('/api/v1/enrollments', enrollmentRoutes);
app.route('/api/v1/upload', uploadRoutes);
app.route('/api/v1/quizzes', quizRoutes);
app.route('/api/v1/assignments', assignmentRoutes);
app.route('/api/v1/certificates', certificateRoutes);
app.route('/api/v1/discussions', discussionRoutes);
app.route('/api/v1/announcements', announcementRoutes);
app.route('/api/v1/notifications', notificationRoutes);
app.route('/api/v1/users', userRoutes);
app.route('/api/v1/analytics', analyticsRoutes);
app.route('/api/v1/integrations/sidiq', sidiqIntegrationRoutes);

// Static file server untuk /uploads/* dengan dukungan Range (streaming video)
const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};

app.get('/uploads/*', (c) => {
  const rel = decodeURIComponent(c.req.path.replace(/^\/uploads\//, ''));
  const filePath = path.normalize(path.join(UPLOAD_DIR, rel));
  if (!filePath.startsWith(UPLOAD_DIR)) return c.json({ error: 'Forbidden' }, 403);

  let st: fs.Stats;
  try {
    st = fs.statSync(filePath);
  } catch {
    return c.notFound();
  }
  if (!st.isFile()) return c.notFound();

  const total = st.size;
  const rangeHeader = c.req.header('Range');
  let start = 0;
  let end = total - 1;
  let status = 200;

  if (rangeHeader) {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (m) {
      if (m[1]) start = parseInt(m[1], 10);
      if (m[2]) end = parseInt(m[2], 10);
      status = 206;
    }
  }
  if (start > end || start >= total) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }
  end = Math.min(end, total - 1);
  const chunkSize = end - start + 1;

  const stream = fs.createReadStream(filePath, { start, end });
  const webStream = Readable.toWeb(stream as any) as ReadableStream;

  return new Response(webStream, {
    status,
    headers: {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(chunkSize),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

// Liveness: proses hidup (tanpa cek dependensi).
app.get('/health', (c) => c.json({ status: 'ok' }));

// Readiness: proses hidup DAN database dapat diakses (untuk orchestrator/monitoring).
app.get('/ready', async (c) => {
  const dbOk = await checkDatabase();
  return c.json({ status: dbOk ? 'ready' : 'degraded', database: dbOk }, dbOk ? 200 : 503);
});

export { app };
export default app;
