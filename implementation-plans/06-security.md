# 06 — Keamanan

> **Kembali ke:** [Index](./00-INDEX.md)

---

## JWT Strategy

### Access Token
- **Expire:** 15 menit
- **Storage:** Zustand in-memory ONLY (tidak pernah ke `localStorage`, tidak ke cookie)
- **Implikasi:** Tab baru / refresh browser → perlu `/auth/refresh` untuk dapat access token baru

### Refresh Token
- **Expire:** 7 hari
- **Storage:** `localStorage` (di browser)
- **Rotation:** Setiap `/auth/refresh`, refresh token lama **di-invalidate** di database, issue token baru

### Token Flow
```
Login → access token (15m, memory) + refresh token (7d, localStorage)

Access token expire:
  → Frontend auto-call POST /auth/refresh (via Axios interceptor)
  → Jika refresh valid: dapat access token baru + refresh token baru
  → Jika refresh invalid/expire: logout paksa → redirect /login

Logout:
  → DELETE refresh token dari DB
  → Clear Zustand state
  → Clear localStorage
```

### Blacklisting Logout
Refresh token yang sudah di-logout disimpan di tabel `refresh_tokens` dengan `deleted_at` atau langsung dihapus dari tabel. Approach yang digunakan: **hapus dari tabel** saat logout — sehingga refresh token tidak valid = tidak ada di DB.

---

## Rate Limiting

Implementasi: middleware Hono + ioredis (sliding window counter per IP)

| Endpoint | Limit | Window |
|---|---|---|
| `POST /auth/login` | 5 request | 15 menit |
| `POST /auth/register` | 3 request | 1 jam |
| `POST /auth/forgot-password` | 3 request | 1 jam |
| `POST /upload/*` | 10 request | 1 menit |
| `GET /api/*` (umum) | 100 request | 1 menit |

**Implementasi middleware:**
```typescript
// middleware/rateLimit.ts
import { createMiddleware } from 'hono/factory';
import { redis } from '../services/redis';

export function rateLimit(key: string, limit: number, windowSec: number) {
  return createMiddleware(async (c, next) => {
    const ip = c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'unknown';
    const redisKey = `rl:${key}:${ip}`;
    
    const current = await redis.incr(redisKey);
    if (current === 1) await redis.expire(redisKey, windowSec);
    
    if (current > limit) {
      return c.json({ error: 'Too many requests, please try again later.' }, 429);
    }
    
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - current)));
    
    await next();
  });
}
```

---

## Input Validation & Sanitization

### Zod Schema (Request Body)

Semua request body divalidasi dengan Zod melalui `@hono/zod-openapi`:

```typescript
// Contoh schema register
const RegisterSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['student', 'teacher']),
});
```

Error dari Zod otomatis di-return sebagai response 400 dengan detail field.

### Rich Text HTML Sanitization

Konten dari TipTap editor (type: `text`) disimpan sebagai HTML. Sebelum simpan ke DB:

```typescript
import DOMPurify from 'isomorphic-dompurify';

const safeHtml = DOMPurify.sanitize(rawHtml, {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em',
                 'a', 'img', 'blockquote', 'code', 'pre', 'br'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target'],
});
```

### File Upload Validation

```typescript
import { fileTypeFromBuffer } from 'file-type';

// Validasi MIME type via magic bytes (bukan dari extension atau Content-Type header)
const buffer = await file.arrayBuffer();
const detected = await fileTypeFromBuffer(buffer);

if (!allowedMimeTypes.includes(detected?.mime)) {
  throw new HTTPException(400, { message: 'Tipe file tidak diizinkan' });
}

// Rename file ke UUID saat upload ke MinIO (cegah path traversal)
const key = `videos/${crypto.randomUUID()}.mp4`;
```

---

## Ownership Authorization

Helper function yang dipakai di semua endpoint yang memodifikasi data:

```typescript
// src/lib/auth.ts

export function assertOwnerOrAdmin(
  instructorId: string,
  currentUser: { id: string; role: string }
): void {
  if (currentUser.role === 'admin') return; // admin boleh semua
  if (instructorId === currentUser.id) return; // owner boleh

  throw new HTTPException(403, {
    message: 'Anda tidak memiliki akses ke resource ini'
  });
}

// Penggunaan:
const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
if (!course) throw new HTTPException(404, { message: 'Kursus tidak ditemukan' });

assertOwnerOrAdmin(course.instructorId, c.get('jwtPayload'));
```

### Enrollment Check

```typescript
export async function assertEnrolled(
  userId: string,
  courseId: string
): Promise<void> {
  const enrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, userId),
      eq(enrollments.courseId, courseId),
      eq(enrollments.status, 'active')
    ),
  });
  
  if (!enrollment) {
    throw new HTTPException(403, { message: 'Anda belum terdaftar di kursus ini' });
  }
}
```

---

## Password Security

```typescript
import { hash, verify } from '@node-rs/bcrypt'; // lebih cepat dari pure JS bcrypt

// Register
const passwordHash = await hash(password, 12); // cost factor 12

// Login
const isValid = await verify(password, user.passwordHash);
```

---

## Password Reset Flow

```
1. POST /auth/forgot-password { email }
   → Generate token: crypto.randomBytes(32).toString('hex')
   → Hash token → simpan ke tabel password_reset_tokens (expire 1 jam)
   → Kirim email: link = APP_URL/reset-password?token={raw_token}

2. POST /auth/reset-password { token, newPassword }
   → Hash incoming token → cari di DB
   → Jika tidak ada atau expired → 400
   → Update user.passwordHash
   → Hapus token dari DB
   → Invalidate semua refresh_tokens user ini
```

> **Catatan:** Tambahkan tabel `password_reset_tokens` di schema (opsional Fase 4, bisa tambah via migration):
> ```typescript
> export const passwordResetTokens = pgTable('password_reset_tokens', {
>   id:        uuid('id').defaultRandom().primaryKey(),
>   userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
>   tokenHash: varchar('token_hash', { length: 255 }).notNull(),
>   expiresAt: timestamp('expires_at').notNull(),
>   createdAt: timestamp('created_at').defaultNow(),
> });
> ```

---

## Checklist Security Sebelum Produksi

- [ ] `JWT_SECRET` dan `JWT_REFRESH_SECRET` menggunakan nilai random 256-bit
- [ ] Database `DB_PASSWORD` kuat dan tidak default
- [ ] MinIO tidak expose port 9001 (Console) ke public
- [ ] Nginx security headers aktif
- [ ] HTTPS dengan SSL certificate (Let's Encrypt via Certbot)
- [ ] Rate limiting aktif di semua auth endpoint
- [ ] File upload: MIME type validation via magic bytes
- [ ] HTML dari rich text editor di-sanitize sebelum simpan
- [ ] Refresh token rotation berfungsi
- [ ] `isActive = false` → user tidak bisa login
