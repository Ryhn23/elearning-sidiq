# E-Learning Platform

Platform e-learning full-stack: kursus berbasis video/dokumen, kuis, tugas (assignment), diskusi forum, pengumuman, sertifikat digital, dan panel admin.

## Tech Stack

| Layer     | Teknologi                                                        |
| --------- | ---------------------------------------------------------------- |
| Frontend  | React 19 + TypeScript, Vite, Tailwind CSS v4, TanStack Query, Zustand, React Router v7 |
| Backend   | Hono (Node) + OpenAPI (zod-openapi), Drizzle ORM                 |
| Database  | PostgreSQL 15                                                     |
| File      | Upload streaming ke disk lokal (`backend/uploads/`), served via `/uploads/*` |
| Email     | Nodemailer (dry-run ke console jika SMTP belum dikonfigurasi)    |
| Auth      | JWT access token (15 mnt) + refresh token rotation (7 hari), bcrypt, Google OAuth (opsional) |
| Infra     | Docker Compose (db + backend + frontend), Redis opsional untuk rate limiter terpusat |

## Struktur Proyek

```
├── implementation-plans/  # Dokumentasi lengkap (00–13): arsitektur, skema DB, API, fase implementasi
├── backend/         # Hono API — src/routes/*, services/*, db/schema.ts (24 tabel)
└── frontend/        # React SPA — src/pages/*, components/*, store/, hooks/
```

Mulai dari [`implementation-plans/01-overview.md`](implementation-plans/01-overview.md), lalu baca `02`–`07` untuk detail desain. Status implementasi per fase ada di [`implementation-plans/00-INDEX.md`](implementation-plans/00-INDEX.md). Kesiapan produksi: [`implementation-plans/13-production.md`](implementation-plans/13-production.md).

## Quick Start (Docker)

Prasyarat: Docker + Docker Compose, PostgreSQL tersedia di port 5432 (compose akan menjalankan Postgres sendiri).

```bash
# 1. Secrets untuk Docker Compose (WAJIB — compose menolak start jika kosong)
cp .env.example .env          # isi JWT_SECRET & JWT_REFRESH_SECRET (acak, min. 32 char)

# 2. Siapkan database backend
cd backend
cp .env.example .env          # sesuaikan DATABASE_URL & JWT_SECRET
npm install
npx drizzle-kit push          # buat skema (24 tabel)
npx tsx seed.ts               # data awal: user, kategori, kursus contoh

# 3. Jalankan semua service
cd ..
docker compose up --build -d
```

Akses:

| Service   | URL                          |
| --------- | ---------------------------- |
| Frontend  | http://localhost:8080        |
| API       | http://localhost:3000/api/v1 |
| Swagger   | http://localhost:3000/ui     |

> **Catatan Docker:** `APP_URL` di compose sudah diset ke `http://localhost:8080`. Jika deploy ke domain lain, sesuaikan `APP_URL` di file `.env` root (dipakai untuk tautan email & redirect Google OAuth).

## Production Deployment

Checklist lengkap (secrets, TLS, backup, monitoring, baseline performa) ada di [`implementation-plans/13-production.md`](implementation-plans/13-production.md). Ringkas:

```bash
# Backup database harian (retensi 7 hari)
./scripts/backup.sh

# Load test cepat
node scripts/loadtest.mjs
```

## Development (tanpa Docker)

```bash
# Terminal 1 — database
# Jalankan PostgreSQL lokal dengan database "elearning" (user: user / password: password)

# Terminal 2 — backend (http://localhost:3000, hot reload)
cd backend
cp .env.example .env
npm install
npx drizzle-kit push
npx tsx seed.ts               # sekali saja
npm run dev

# Terminal 3 — frontend (http://localhost:5174, proxy /api → :3000)
cd frontend
npm install
npm run dev
```

## Akun Default (hasil seed)

| Role    | Email                          | Password      |
| ------- | ------------------------------ | ------------- |
| Admin   | admin@elearning.com            | password123   |
| Teacher | teacher@elearning.com          | password123   |
| Student | budi@student.com (dsb., 5 akn)| password123   |

## Alur Utama

- **Student:** register → login → browse katalog → enroll → belajar (video/dokumen) → kuis → submit tugas → diskusi → sertifikat.
- **Teacher:** buat kursus (section + lesson) → upload video/dokumen → susun kuis & tugas → grade submission → kelola diskusi kelas.
- **Admin:** publish/unpublish kursus, kelola user & kategori, lihat analytics dashboard.

## Keamanan

- Password: bcrypt; validasi input: zod di semua endpoint.
- Rate limiting per IP (login 5/15 mnt, register 3/jam, forgot-password 3/jam, upload 10/mnt, API umum 100/mnt). Redis dipakai jika `REDIS_URL` diset, fallback in-memory.
- Refresh token rotation + invalidasi saat ganti password / reset password / logout.
- Konten HTML user di-sanitize (DOMPurify) sebelum disimpan; XSS-safe.
- CORS dibatasi origin frontend (`APP_URL` + origin lokal dev), bukan wildcard.

## Konfigurasi

Semua variabel environment terdokumentasi di [`backend/.env.example`](backend/.env.example). Fitur opsional: SMTP (email nyata), Google OAuth, Redis.

## Status Implementasi

Status diperbarui setiap kali fase implementasi ditutup.

- [x] **Fase 1** — Core Foundation (Minggu 1–2) ✅ **SELESAI**: skema DB 24 tabel, CRUD API kursus/section/lesson/enrollment, seed data, UI dasar. QA fase ini: backend 97/97 test + typecheck bersih, frontend 22/22 test + typecheck bersih.
- [x] **Fase 2** — Media & Assessment (Minggu 3–4) ✅ **SELESAI**: upload via disk lokal + busboy streaming (deviasi MinIO sudah diakomodasi), VideoPlayer custom + resume + auto-complete 80%, quiz engine, assignment, email (welcome/enrollment/graded/quiz/certificate). QA fase ini lolos: backend 97/97 test, frontend 22/22 test.
- [x] **Fase 3** — Student Experience & Admin (Minggu 5–6) ✅ **SELESAI**: diskusi, pengumuman, notifikasi, sertifikat (auto-generate via progress + manual), grade/gradebook/CSV export, user mgmt, admin panel. QA fase ini lolos: backend 97/97 test, frontend 22/22 test. (QA admin tambahan: user management/analytics/category via `admin-management.test.ts` — 21 test lolos, backend → 97/97.)
- [x] **Fase 4** — Auth Lanjut, Analytics & Polish (Minggu 7–8) ✅ **SELESAI**: refresh token rotation, Google OAuth bind/login, forgot/reset password, analytics overview + KPI admin, rate limiting, sanitasi, TanStack Query, lazy load, security hardening. QA fase ini lolos: backend 97/97 test, frontend 22/22 test.
- [x] **Production Readiness** — [`implementation-plans/13-production.md`](implementation-plans/13-production.md) ✅ **TERAPILKAN**: CSP/nginx security headers, rate limit, sanitasi, env fail-fast, graceful shutdown, `/ready` healthcheck, backup & load test (commit hardening `0e7e52a`). Verifikasi akhir (titik 2): backend build produksi ✅ + backend QA 97/97 ✅ + frontend build ✅ + frontend QA 22/22 ✅ + Docker Compose config ✅.
- [x] **E2E Browser (Playwright)** — `frontend/e2e/` (landing, catalog, admin auth): **3/3 test lolos** terhadap staging Docker lokal (baseURL `http://localhost:8080`). Tahap E2E per role: **Admin** (buat user + setup kategori) — **1/1 lolos** (`admin-workflow.spec.ts`).
