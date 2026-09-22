# 05 — Infrastruktur & DevOps

> **Kembali ke:** [Index](./00-INDEX.md)

---

## Docker Compose (Updated)

File: `docker-compose.yml`

```yaml
version: '3.9'

services:
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-elearning}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-elearning}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-elearning}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"   # API (diakses backend)
      - "9001:9001"   # MinIO Console (untuk management, bisa ditutup di prod)
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${DB_USER:-elearning}:${DB_PASSWORD}@db:5432/${DB_NAME:-elearning}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_ACCESS_EXPIRES: 15m
      JWT_REFRESH_EXPIRES: 7d
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_USE_SSL: false
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_BUCKET: ${MINIO_BUCKET:-elearning}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_CALLBACK_URL: ${APP_URL}/api/v1/auth/google/callback
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      FROM_EMAIL: ${FROM_EMAIL:-noreply@elearning.example.com}
      APP_URL: ${APP_URL:-http://localhost:8080}
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 512M

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - backend
    deploy:
      resources:
        limits:
          memory: 128M

  nginx:
    image: nginx:1.25-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro   # optional SSL certs
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## Environment Variables (`.env.example`)

```env
# ──── Database ────────────────────────────────
DB_USER=elearning
DB_PASSWORD=strong_password_here
DB_NAME=elearning

# ──── JWT ─────────────────────────────────────
# Wajib: 256-bit random string, jangan gunakan nilai ini di produksi!
JWT_SECRET=ganti_ini_dengan_random_256bit_secret
JWT_REFRESH_SECRET=ganti_ini_dengan_random_256bit_secret_lain

# ──── Redis ───────────────────────────────────
REDIS_PASSWORD=redis_password_here

# ──── MinIO Object Storage ────────────────────
MINIO_ACCESS_KEY=minio_access_key
MINIO_SECRET_KEY=minio_secret_min_8_chars
MINIO_BUCKET=elearning

# ──── Google OAuth ────────────────────────────
# Buat di: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# ──── SMTP Email ──────────────────────────────
# Development: gunakan Mailtrap.io (gratis)
# Production: Gmail SMTP, SendGrid, Brevo, dll
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_pass
FROM_EMAIL=noreply@elearning.example.com

# ──── App ─────────────────────────────────────
APP_URL=http://localhost:8080
```

---

## Nginx Configuration

File: `nginx/nginx.conf`

```nginx
user nginx;
worker_processes auto;

events {
  worker_connections 1024;
}

http {
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;

  # ──── Gzip ────────────────────────────────
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml;
  gzip_min_length 1000;

  # ──── Security Headers ────────────────────
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header X-XSS-Protection "1; mode=block" always;
  # CSP: sesuaikan jika ada CDN/external resources
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' blob: https:;" always;

  # ──── Rate Limit Zones ────────────────────
  limit_req_zone $binary_remote_addr zone=api_general:10m rate=100r/m;
  limit_req_zone $binary_remote_addr zone=api_auth:10m rate=10r/m;
  limit_req_zone $binary_remote_addr zone=api_upload:10m rate=10r/m;

  server {
    listen 80;
    server_name _;

    # ──── Frontend SPA ─────────────────────
    location / {
      proxy_pass http://frontend:80;
      proxy_set_header Host $host;
    }

    # ──── Static assets (via frontend nginx) ─
    # (Frontend Dockerfile sudah handle cache headers)

    # ──── Backend API ──────────────────────
    location /api/ {
      limit_req zone=api_general burst=50 nodelay;

      proxy_pass http://backend:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;

      client_max_body_size 2G;     # untuk upload video
      proxy_read_timeout 300s;
      proxy_send_timeout 300s;
    }

    # ──── Auth endpoints (ketat rate limit) ─
    location ~ ^/api/v1/auth/(login|register|forgot-password|reset-password) {
      limit_req zone=api_auth burst=5 nodelay;

      proxy_pass http://backend:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

      client_max_body_size 1M;
    }

    # ──── Upload endpoints ─────────────────
    location /api/v1/upload/ {
      limit_req zone=api_upload burst=5 nodelay;

      proxy_pass http://backend:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;

      client_max_body_size 2G;
      proxy_read_timeout 600s;    # upload video butuh waktu lama
    }
  }
}
```

---

## Backend Services

### `services/storage.ts` — MinIO Client

```typescript
// Interface publik service ini:

uploadFile(bucket: string, key: string, buffer: Buffer, mimeType: string): Promise<string>
// Returns: public URL atau key untuk dipakai di getSignedUrl

getSignedUrl(bucket: string, key: string, expirySeconds: number): Promise<string>
// Returns: presigned URL untuk streaming video (expire X detik)

deleteFile(bucket: string, key: string): Promise<void>

fileExists(bucket: string, key: string): Promise<boolean>
```

**Key convention:**
```
videos/{uuid}.mp4
documents/{uuid}.pdf
images/{uuid}.webp
submissions/{uuid}/{filename}
certificates/{uuid}.pdf
```

---

### `services/email.ts` — Nodemailer

Template email yang dikirim sistem:

| Template | Trigger | Isi |
|---|---|---|
| `welcome` | Setelah register | Sambutan + link login |
| `enrollment_confirmed` | Setelah enroll | Nama kursus + link mulai belajar |
| `assignment_graded` | Setelah tugas dinilai | Skor + feedback + link tugas |
| `quiz_passed` | Quiz lulus | Skor + link sertifikat (jika kursus selesai) |
| `quiz_failed` | Quiz gagal | Skor + sisa attempt + link coba lagi |
| `certificate_issued` | Kursus 100% selesai | Nama kursus + link verifikasi + PDF attachment |
| `zoom_reminder` | 1 jam sebelum Zoom | Info meeting + link Zoom |
| `password_reset` | Forgot password | Link reset (expire 1 jam) |
| `new_announcement` | Pengumuman baru | Judul + isi + link kursus |

---

### `services/certificate.ts` — PDF Generation

```typescript
// Flow:
// 1. Generate kode unik (nanoid, 12 char: ABC-DEF-GHI)
// 2. Buat PDF dengan pdf-lib:
//    - Background template dari assets/cert-template.png
//    - Text: nama student, nama kursus, nama instruktur, tanggal
//    - QR Code (qrcode) → URL: APP_URL/verify/{code}
// 3. Upload PDF ke MinIO: certificates/{uuid}.pdf
// 4. Simpan ke tabel certificates: { userId, courseId, code, pdfUrl }
// 5. Return { code, pdfUrl }
```

---

### `services/progress.ts` — Progress Calculator

Dipanggil setiap kali `lesson_progress` diupdate (setelah mark complete/uncomplete):

```typescript
async function recalculateProgress(userId: string, courseId: string): Promise<void> {
  // 1. Hitung total lesson visible di kursus
  // 2. Hitung completed lessons dari lesson_progress
  // 3. Update enrollments.progress = (completed / total) * 100
  // 4. Jika progress = 100.0:
  //      - Set enrollments.completed_at = now()
  //      - Set enrollments.status = 'completed'
  //      - Jika course.certificate_enabled:
  //          → generate certificate
  //          → kirim notifikasi internal
  //          → kirim email certificate_issued
  // 5. Recalculate grades.final_grade
}
```

---

### `services/notification.ts` — Notification Dispatcher

```typescript
async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}): Promise<void>

// Digunakan di:
// - enrollment → type: 'enrollment'
// - announcement baru → type: 'announcement' (ke semua enrolled)
// - assignment graded → type: 'assignment_graded'
// - quiz result → type: 'quiz_result'
// - reply to discussion → type: 'discussion_reply'
// - certificate issued → type: 'enrollment' (repurposed)
// - zoom reminder → type: 'zoom_reminder'
```

---

## Drizzle ORM Commands

```bash
# Generate migration dari perubahan schema.ts
cd backend && npm run db:generate

# Push migration ke database (development)
cd backend && npm run db:push

# Buka Drizzle Studio (browser DB viewer)
cd backend && npm run db:studio

# Jalankan seed
cd backend && tsx seed.ts
```

**`drizzle.config.ts`:**
```typescript
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
};
```

---

## MinIO Initial Setup

Setelah container MinIO pertama kali berjalan:

```bash
# Install MinIO CLI (mc)
curl https://dl.min.io/client/mc/release/linux-amd64/mc -o mc
chmod +x mc

# Tambah alias
./mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

# Buat bucket
./mc mb local/elearning

# Set policy publik untuk sertifikat (agar bisa diakses tanpa signed URL)
./mc policy set public local/elearning/certificates

# Cek status
./mc ls local/elearning
```

Alternatif: buat bucket via MinIO Console di `http://localhost:9001`.
