# 📚 E-Learning Platform — Documentation Index

> **Stack:** Hono.js + Drizzle ORM + PostgreSQL + React 19 + TailwindCSS v4  
> **Skala:** ~500 pengguna | **Referensi:** Moodle LMS | **Timeline:** 8 Minggu

---

## Navigasi Dokumen

| File | Isi | Baca Dulu? |
|---|---|---|
| [01-overview.md](./01-overview.md) | Analisis codebase, arsitektur, struktur platform, role matrix | ✅ Wajib |
| [02-database-schema.md](./02-database-schema.md) | 24 tabel Drizzle ORM lengkap dengan semua field dan relasi | ✅ Wajib |
| [03-backend-api.md](./03-backend-api.md) | 60+ endpoint API: method, path, auth, role, deskripsi | ✅ Wajib |
| [04-frontend-pages.md](./04-frontend-pages.md) | Spesifikasi 20+ halaman, komponen, routing map | ✅ Wajib |
| [05-infrastructure.md](./05-infrastructure.md) | Docker Compose, Nginx, MinIO, Redis, environment vars | Sebelum deploy |
| [06-security.md](./06-security.md) | JWT strategy, rate limiting, input validation, ownership | Sebelum deploy |
| [07-dependencies.md](./07-dependencies.md) | Daftar semua package baru backend + frontend | Sebelum install |
| [08-phase1.md](./08-phase1.md) | 🚀 **FASE 1** — Core Foundation (Minggu 1-2): DB + CRUD + UI dasar | Fase aktif |
| [09-phase2.md](./09-phase2.md) | 🎬 **FASE 2** — Media & Assessment (Minggu 3-4): Video + Quiz + Email | Setelah Fase 1 |
| [10-phase3.md](./10-phase3.md) | 💬 **FASE 3** — Student Experience & Admin (Minggu 5-6) | Setelah Fase 2 |
| [11-phase4.md](./11-phase4.md) | 🔒 **FASE 4** — Auth Lanjut, Analytics & Polish (Minggu 7-8) | Setelah Fase 3 |
| [12-verification.md](./12-verification.md) | Critical flows, checklist per fase, target Lighthouse | Saat testing |
| [13-production.md](./13-production.md) | 🚀 **PRODUCTION** — hardening, deployment, backup, baseline performa | Sebelum deploy |

---

## Timeline Ringkasan

```
Minggu 1-2  │ FASE 1 │ Schema DB + CRUD API + UI dasar
Minggu 3-4  │ FASE 2 │ Video upload + Quiz + Assignment + Email
Minggu 5-6  │ FASE 3 │ Diskusi + Notif + Sertifikat + Admin panel
Minggu 7-8  │ FASE 4 │ Google OAuth bind + Analytics + Security + Polish
```

## Gap Kritis (Sekarang vs Target)

```
Database  : 2 tabel   → 24 tabel
API       : 4 endpoint → 60+ endpoint
Frontend  : 2 halaman  → 20+ halaman
Media     : tidak ada  → MinIO S3
Auth      : JWT manual → + Google OAuth bind
```

## Status Progress

> Update checklist ini setiap selesai satu fase.

- [x] **Fase 1** — Core Foundation (24 tabel, CRUD API, UI dasar)
- [x] **Fase 2** — Media & Assessment (upload streaming, quiz, assignment, email dry-run/SMTP)
- [x] **Fase 3** — Student Experience & Admin (diskusi, notifikasi, sertifikat, admin panel)
- [x] **Fase 4** — Auth Lanjut & Polish (refresh token rotation, Google OAuth bind, analytics, CORS, rate limit)
- [x] **Production Readiness** — env fail-fast, graceful shutdown, error handler, readiness, gzip/cache, image produksi tanpa dev deps, backup script, load test, Lighthouse 96/100/100/100 (lihat [13-production.md](./13-production.md))

### Catatan Deviasi dari Desain Awal

| Item | Desain awal | Implementasi | Alasan |
|---|---|---|---|
| Penyimpanan file | MinIO S3 | Disk lokal (`backend/uploads/`) + streaming | Lebih sederhana untuk skala ~500 user; endpoint API tetap sama, mudah dimigrasikan ke S3 nanti |
| Redis | Wajib (rate limit) | Opsional — fallback in-memory | Single-instance cukup; `REDIS_URL` tinggal diisi kalau multi-instance |
| Test suite | Vitest + coverage | ✅ 69 test backend (termasuk alur kritis e2e) + 18 test frontend | Selesai |

### Verifikasi yang Sudah Dilakukan (manual, via curl ke server Docker)

- [x] Login → access token (15 mnt) + refresh token (7 hari)
- [x] Refresh token rotation: reuse token lama → 401
- [x] Logout: refresh token terhapus dari DB (refresh setelah logout → 401)
- [x] CORS: origin asing diblokir, origin frontend diizinkan
- [x] Rate limit upload: 10×/menit per IP (ke-11 → 429)
- [x] `GET /health` backend + healthcheck Docker semua service
- [x] Test suite otomatis: 69 test backend (Vitest, termasuk alur kritis end-to-end) + 18 test frontend (RTL)
- [x] Lighthouse audit: Performance 96 · Accessibility 100 · Best Practices 100 · SEO 100
- [x] Load test: ~400 req/s, 0 error, p95 < 100 ms (lokal)
- [ ] **Tersisa (infrastruktur eksternal):** backup offsite, TLS di domain produksi, alerting ke `/ready`
