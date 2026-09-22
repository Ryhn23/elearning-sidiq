import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/jwt';
import { streamToFile, type UploadKind } from '../services/storage';
import { parseMultipart } from '../services/multipart';

const uploadRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string; email: string; name: string };

const LIMITS: Record<UploadKind, number> = {
  video: 2 * 1024 * 1024 * 1024, // 2GB
  document: 50 * 1024 * 1024,   // 50MB
  image: 5 * 1024 * 1024,       // 5MB
  assignment: 50 * 1024 * 1024, // 50MB
};

const ROLE_FOR_KIND: Record<UploadKind, string[]> = {
  video: ['teacher', 'admin'],
  document: ['teacher', 'admin'],
  image: ['student', 'teacher', 'admin'],
  assignment: ['student', 'teacher', 'admin'],
};

function makeUploadRoute(kind: UploadKind, pathSuffix: string) {
  // Catatan: body multipart TIDAK dideklarasikan di OpenAPI route karena
  // validator zod-openapi akan mengonsumsinya sebelum handler berjalan.
  // Parsing dilakukan manual via busboy (streaming ke disk).
  const route = createRoute({
    method: 'post',
    path: pathSuffix,
    middleware: [authMiddleware],
    responses: {
      200: { description: 'Uploaded', content: { 'application/json': { schema: z.any() } } },
      400: { description: 'Bad Request' },
      403: { description: 'Forbidden' },
    },
  });

  return uploadRoutes.openapi(route, async (c) => {
    const payload = c.get('jwtPayload' as never) as JwtPayload;
    if (!ROLE_FOR_KIND[kind].includes(payload.role)) {
      return c.json({ error: 'Anda tidak memiliki izin untuk upload ini' }, 403);
    }

    const parsed = await parseMultipart(c, LIMITS[kind]);
    if (!parsed) return c.json({ error: 'Tidak ada file dalam request' }, 400);

    const result = await streamToFile(parsed.file, kind, parsed.name, parsed.mimeType, LIMITS[kind]);
    if ('error' in result) return c.json({ error: result.error }, 400);

    return c.json({
      url: result.url,
      fileName: result.fileName,
      sizeBytes: result.sizeBytes,
      mimeType: parsed.mimeType,
    }, 200);
  });
}

// POST /video — upload video (teacher/admin)
makeUploadRoute('video', '/video');
// POST /document — upload dokumen (teacher/admin)
makeUploadRoute('document', '/document');
// POST /image — upload gambar (any authenticated)
makeUploadRoute('image', '/image');
// POST /assignment — upload file tugas (student)
makeUploadRoute('assignment', '/assignment');

// GET /signed-url — kembalikan URL untuk streaming (enrolled/owner)
const signedUrlRoute = createRoute({
  method: 'get',
  path: '/signed-url',
  middleware: [authMiddleware],
  request: { query: z.object({ url: z.string().min(1) }) },
  responses: {
    200: { description: 'URL', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
  },
});

uploadRoutes.openapi(signedUrlRoute, async (c) => {
  const { url } = c.req.query();
  // Hanya izinkan path internal storage (anti open-redirect / traversal)
  if (!url.startsWith('/uploads/')) return c.json({ error: 'URL tidak valid' }, 403);
  return c.json({ url }, 200);
});

export default uploadRoutes;
