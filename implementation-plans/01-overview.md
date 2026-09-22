# 01 — Overview: Analisis, Arsitektur & Struktur Platform

> **Kembali ke:** [Index](./00-INDEX.md)

---

## 1. Analisis Codebase Saat Ini

### Yang Sudah Ada (Solid, Tidak Perlu Diubah)

| File | Deskripsi | Status |
|---|---|---|
| `backend/src/db/index.ts` | Koneksi Drizzle + postgres.js | ✅ Tidak diubah |
| `backend/src/middleware/jwt.ts` | `authMiddleware` + `roleMiddleware` | ✅ Tidak diubah |
| `frontend/src/lib/api.ts` | Axios instance + JWT interceptor | ✅ Tidak diubah |

### Yang Perlu Dimodifikasi

| File | Status Saat Ini | Perubahan |
|---|---|---|
| `backend/src/db/schema.ts` | 2 tabel (users, courses) | Full rewrite → 24 tabel |
| `backend/src/index.ts` | Hono + Swagger + 2 routes | Tambah register semua routes baru |
| `backend/src/routes/auth.ts` | Register, Login, /me | Tambah Google OAuth + refresh token |
| `backend/src/routes/course.ts` | GET /courses saja | Full rewrite → CRUD lengkap |
| `backend/seed.ts` | Seed 1 admin | Expand → dummy data lengkap |
| `frontend/src/store/authStore.ts` | Basic JWT store | Tambah Google auth state |
| `frontend/src/App.tsx` | 2 routes saja | Full rewrite → 20+ routes |
| `frontend/src/pages/Login.tsx` | Form dasar | Redesign + tombol Google |
| `frontend/src/pages/Dashboard.tsx` | Placeholder | Di-replace per role |
| `docker-compose.yml` | DB + Backend + Frontend | Tambah Redis + MinIO |
| `frontend/nginx.conf` | Proxy dasar | Tambah security headers |

### Gap Kritis

```
Database  : 2 tabel    → 24 tabel
API       : 4 endpoint  → 60+ endpoint
Frontend  : 2 halaman   → 20+ halaman
Media     : tidak ada   → MinIO S3 object storage
Auth      : JWT manual  → + Google OAuth bind
```

---

## 2. Keputusan Arsitektur

### Skala: ~500 Pengguna

| Keputusan | Alasan |
|---|---|
| Single-server Docker Compose | 500 user tidak butuh Kubernetes |
| Redis (bukan message queue) | Cache + blacklist token. Bull/RabbitMQ overkill |
| MinIO single-node | Object storage cukup, tidak perlu distributed |
| PostgreSQL max 20 connections | Cukup untuk beban 500 user concurrent |

### Arsitektur Sistem

```
┌──────────────────────────────────────────────────────────┐
│                    NGINX (port 80/443)                    │
│         Rate limit │ Gzip │ Security headers              │
└────────┬───────────────────────────────────┬─────────────┘
         │ /api/v1/*                         │ /*
┌────────▼───────────┐             ┌─────────▼──────────┐
│   Hono.js API      │             │  React SPA (Nginx)  │
│   OpenAPI 3.0      │             │  TailwindCSS v4     │
│   JWT + RBAC       │             │  Zustand + TanStack │
│   Zod validation   │             └────────────────────┘
└────────┬───────────┘
         │
┌────────┼──────────────────────────┐
│        │                          │
▼        ▼                          ▼
PostgreSQL 15    Redis 7         MinIO
(data utama)  (cache/token)   (file storage)
```

### Autentikasi: Local + Google Bind

**Alur normal:** Email + Password → JWT Access Token + Refresh Token

**Alur Google Bind (BUKAN direct register via Google):**
```
1. User wajib buat akun lokal dulu (email + password)
2. Settings → "Hubungkan dengan Google"
3. Redirect Google OAuth → dapat google_id + google_email
4. Simpan ke users.google_id
5. Setelah bind: bisa login via tombol "Login dengan Google"
```

**Flow detail Google Bind:**
```
POST /auth/me/google/bind
→ Backend generate OAuth URL (Google) dengan state={userId}
→ Return { authUrl: "https://accounts.google.com/o/oauth2/auth?..." }
→ Frontend redirect user ke authUrl

GET /auth/me/google/callback?code=...&state={userId}
→ Tukar code dengan token Google
→ Ambil google_id + google_email dari Google Profile API
→ Simpan ke users.google_id dan users.google_email
→ Redirect ke /settings?google_bind=success
```

**Flow Login via Google (setelah bind):**
```
GET /auth/google/login → redirect ke Google
GET /auth/google/callback?code=...
→ Ambil google_id dari Google
→ Cari user WHERE google_id = {google_id}
→ Jika tidak ada: error "Akun Google belum dihubungkan"
→ Jika ada: issue accessToken + refreshToken → redirect dashboard
```

### Mode Pembelajaran: Async + Zoom

- **Tidak ada** fitur WebRTC/live streaming bawaan
- Lesson `zoom_link`: simpan URL meeting + jadwal → tampilkan info + countdown
- Untuk kelas live: guru buat meeting Zoom sendiri, paste link ke lesson

---

## 3. Struktur Platform (Moodle-inspired)

### Pemetaan Konsep Moodle

```
MOODLE CONCEPT          IMPLEMENTASI KITA
────────────────────────────────────────────
Course                  Course (kursus)
Section/Topic           CourseSection (bab/topik, berurutan)
Activity/Resource       Lesson (aktivitas dalam bab, berurutan)
  File/URL resource       type: 'video' | 'document' | 'text'
  External URL            type: 'zoom_link'
  Assignment              type: 'assignment'
  Quiz                    type: 'quiz'
Forum                   Discussion (thread + replies per kursus/lesson)
Gradebook               Grade (rekap nilai quiz + tugas)
Completion Tracking     LessonProgress + Enrollment.progress
Enrollment              Enrollment (self-enroll + manual admin)
Certificate             Certificate (auto-generate saat 100% selesai)
```

### Hirarki Konten

```
Platform
└── Course (Kursus)
    ├── Meta: judul, deskripsi, thumbnail, level, status
    ├── Instructor → users (teacher)
    ├── Category
    └── CourseSection[] (Bab/Topik, sortOrder)
        └── Lesson[] (Aktivitas, sortOrder)
            ├── type: 'video'       → videoUrl di MinIO
            ├── type: 'document'    → documentUrl di MinIO
            ├── type: 'text'        → HTML content (TipTap)
            ├── type: 'zoom_link'   → zoomUrl + zoomStartAt
            ├── type: 'assignment'  → instruksi + due date
            └── type: 'quiz'        → soal pilihan ganda/essay
```

### Role & Permission Matrix

| Aksi | Admin | Teacher | Student |
|---|:---:|:---:|:---:|
| Buat/edit kursus sendiri | ✅ | ✅ | ❌ |
| Edit kursus orang lain | ✅ | ❌ | ❌ |
| Publish/approve kursus | ✅ | ❌ | ❌ |
| Enroll ke kursus | ✅ | ✅ | ✅ |
| Akses konten kursus | ✅ | ✅ | Jika enrolled |
| Lihat nilai semua student | ✅ | Di kursusnya | ❌ |
| Buat user baru | ✅ | ❌ | ❌ |
| Analytics global | ✅ | ❌ | ❌ |
| Analytics kursusnya sendiri | ✅ | ✅ | ❌ |

### Status Alur Kursus

```
draft → pending_review → published
                    ↘
                  archived  (dari published atau pending)
```

- **Teacher** bisa: `draft → pending_review` (klik Submit untuk Review)
- **Admin** bisa: `pending_review → published`, atau langsung publish
- **Teacher/Admin** bisa: `published → archived`

---

## 4. Struktur Direktori Target Lengkap

```
elearning-new/
├── docs/                        ← folder dokumentasi ini
│   ├── 00-INDEX.md
│   ├── 01-overview.md           ← file ini
│   ├── 02-database-schema.md
│   ├── 03-backend-api.md
│   ├── 04-frontend-pages.md
│   ├── 05-infrastructure.md
│   ├── 06-security.md
│   ├── 07-dependencies.md
│   ├── 08-phase1.md
│   ├── 09-phase2.md
│   ├── 10-phase3.md
│   └── 11-phase4.md
│
├── IMPLEMENTATION_PLAN.md       ← file monolitik asli (arsip)
├── .env.example                 NEW
├── docker-compose.yml           MODIFY
├── nginx/
│   └── nginx.conf               NEW (dipindah dari frontend/)
│
├── backend/
│   ├── .env
│   ├── Dockerfile
│   ├── drizzle.config.ts
│   ├── seed.ts                  EXPAND
│   ├── package.json             MODIFY (tambah deps)
│   └── src/
│       ├── index.ts             MODIFY (register semua routes)
│       ├── db/
│       │   ├── index.ts         tidak berubah
│       │   └── schema.ts        FULL REWRITE (24 tabel)
│       ├── middleware/
│       │   ├── jwt.ts           tidak berubah
│       │   ├── rateLimit.ts     NEW
│       │   └── upload.ts        NEW (busboy file upload handler)
│       ├── routes/
│       │   ├── auth.ts          MODIFY (+ Google OAuth, refresh token)
│       │   ├── user.ts          NEW
│       │   ├── category.ts      NEW
│       │   ├── course.ts        FULL REWRITE
│       │   ├── section.ts       NEW
│       │   ├── lesson.ts        NEW
│       │   ├── enrollment.ts    NEW
│       │   ├── assignment.ts    NEW
│       │   ├── quiz.ts          NEW
│       │   ├── upload.ts        NEW
│       │   ├── discussion.ts    NEW
│       │   ├── announcement.ts  NEW
│       │   ├── notification.ts  NEW
│       │   ├── grade.ts         NEW
│       │   ├── certificate.ts   NEW
│       │   └── analytics.ts     NEW
│       └── services/
│           ├── storage.ts       NEW (MinIO client)
│           ├── email.ts         NEW (Nodemailer + templates)
│           ├── certificate.ts   NEW (pdf-lib PDF generation)
│           ├── progress.ts      NEW (progress calculator)
│           └── notification.ts  NEW (create & dispatch notifications)
│
└── frontend/
    ├── index.html               MODIFY (lang=id, meta SEO)
    ├── vite.config.ts           MODIFY (path alias @/)
    ├── tailwind.config.js       MODIFY (design tokens)
    ├── package.json             MODIFY (tambah deps)
    └── src/
        ├── main.tsx
        ├── App.tsx              FULL REWRITE (routing lengkap)
        ├── index.css            MODIFY (CSS custom properties)
        ├── components/
        │   ├── ui/              NEW (21 base components)
        │   ├── layout/          NEW (AppShell, Sidebar, TopNav, dll)
        │   ├── course/          NEW (CourseCard, VideoPlayer, dll)
        │   └── editor/          NEW (RichTextEditor, QuizBuilder, dll)
        ├── pages/
        │   ├── Landing.tsx      NEW
        │   ├── Login.tsx        MODIFY (redesign + Google button)
        │   ├── Register.tsx     NEW
        │   ├── ForgotPassword.tsx  NEW
        │   ├── ResetPassword.tsx   NEW
        │   ├── CourseCatalog.tsx   NEW
        │   ├── CourseDetail.tsx    NEW
        │   ├── CoursePlayer.tsx    NEW
        │   ├── VerifyCertificate.tsx  NEW
        │   ├── student/
        │   │   ├── Dashboard.tsx
        │   │   ├── MyCourses.tsx
        │   │   ├── Grades.tsx
        │   │   ├── Certificates.tsx
        │   │   └── Profile.tsx
        │   ├── teacher/
        │   │   ├── Dashboard.tsx
        │   │   ├── MyCourses.tsx
        │   │   ├── CourseEditor.tsx
        │   │   ├── Students.tsx
        │   │   └── Gradebook.tsx
        │   └── admin/
        │       ├── Dashboard.tsx
        │       ├── Users.tsx
        │       ├── Courses.tsx
        │       ├── Categories.tsx
        │       └── Analytics.tsx
        ├── store/
        │   ├── authStore.ts         MODIFY
        │   ├── courseStore.ts       NEW
        │   ├── playerStore.ts       NEW
        │   ├── notificationStore.ts NEW
        │   └── uiStore.ts           NEW
        ├── lib/
        │   ├── api.ts               tidak berubah
        │   ├── queryClient.ts       NEW (TanStack Query)
        │   └── utils.ts             NEW (cn(), formatDate(), dll)
        └── hooks/
            ├── useCourses.ts
            ├── useEnrollment.ts
            ├── useProgress.ts
            ├── useQuiz.ts
            └── useNotifications.ts
```
