# 13 — Production Readiness & Deployment

> Dokumen ini adalah checklist kesiapan produksi: keamanan, keandalan, performa, backup, dan monitoring.
> Semua item di bawah **sudah terimplementasi** kecuali yang ditandai ⏳.

---

## 1. Hardening yang Sudah Terpasang

### Backend (Hono)
| Item | Status | Detail |
|---|:---:|---|
| Validasi env fail-fast | ✅ | `src/index.ts` menolak start jika `JWT_SECRET`/`JWT_REFRESH_SECRET` < 32 char, sama persis, atau `DATABASE_URL` kosong di produksi |
| Global error handler | ✅ | `app.onError` — di produksi hanya mengembalikan pesan generik (stack trace tidak bocor); error tetap di-log server-side |
| JSON 404 | ✅ | `app.notFound` konsisten format JSON |
| Readiness endpoint | ✅ | `GET /ready` → cek konektivitas DB (503 jika DB down). `GET /health` = liveness ringan |
| Graceful shutdown | ✅ | SIGTERM/SIGINT → tutup koneksi idle → close server → tutup pool DB (timeout paksa 10 dtk) |
| Pool DB eksplisit | ✅ | `max=10`, `idle_timeout=30s`, `connect_timeout=10s` (`src/db/index.ts`) |
| Header keamanan `/uploads` | ✅ | `X-Content-Type-Options: nosniff` + `Cache-Control: immutable` |
| Rate limiting | ✅ | login 5/15 mnt, register 3/jam, forgot-password 3/jam, upload 10/mnt, API umum 100/mnt (Redis opsional) |
| CORS terbatasi | ✅ | Hanya origin `APP_URL` + localhost dev |
| Swagger disembunyikan di produksi | ✅ | `/ui` & `/doc` hanya aktif saat `NODE_ENV !== 'production'` (404 di prod) |

### Frontend (React)
| Item | Status | Detail |
|---|:---:|---|
| Route lazy-loading | ✅ | Semua halaman `React.lazy` + Suspense |
| Vendor chunk splitting | ✅ | `vendor-react`, `vendor-router`, `vendor-query` terpisah → cache browser stabil |
| ErrorBoundary | ✅ | `components/ErrorBoundary.tsx` — cegah white screen, tombol muat ulang/beranda |
| Token refresh single-flight | ✅ | `lib/api.ts` — satu request refresh sekaligus, retry otomatis 401 |

### Nginx (frontend container)
| Item | Status | Detail |
|---|:---:|---|
| Gzip on-the-fly | ✅ | HTML/JS/CSS/JSON/SVG/woff2, `gzip_comp_level 5` |
| Cache immutable | ✅ | `/assets/*` → `max-age=31536000`; `index.html` → `no-cache` |
| Security headers | ✅ | X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| `server_tokens off` | ✅ | Versi nginx tidak dibocorkan |
| Upload limit | ✅ | `client_max_body_size 500M` |
| Proxy `/uploads/` | ✅ | Dengan `proxy_force_ranges on` (streaming video) |

### Docker
| Item | Status | Detail |
|---|:---:|---|
| Image backend produksi | ✅ | Multi-stage, `npm ci --omit=dev` → tanpa dev dependencies |
| `.dockerignore` | ✅ | backend & frontend — node_modules/.env/uploads tidak masuk build context |
| Volume persisten | ✅ | `postgres_data`, `redis_data`, `uploads_data` |
| Healthcheck readiness | ✅ | Backend dicek via `/ready` (termasuk DB) |
| Resource limits | ✅ | CPU/memory limit per service |
| Secrets via env substitution | ✅ | `JWT_SECRET`/`JWT_REFRESH_SECRET` **wajib** dari `.env` root (compose menolak start jika kosong) |

---

## 2. Deployment Produksi

### Prasyarat
- Docker + Docker Compose
- Domain + TLS (lihat catatan di bawah)
- File `.env` di root proyek (bukan `backend/.env`)

### Langkah
```bash
# 1. Secrets & URL publik
cp .env.example .env
# Edit .env:
#   JWT_SECRET=<output dari: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
#   JWT_REFRESH_SECRET=<secret lain, berbeda>
#   APP_URL=https://domain-anda.com

# 2. (Opsional) backend/.env untuk SMTP & Google OAuth nyata
cd backend && cp .env.example .env && cd ..

# 3. Skema + seed (sekali saja)
cd backend
npm install
npx drizzle-kit push
npx tsx seed.ts
cd ..

# 4. Jalankan
docker compose up -d --build
```

### Catatan TLS
Nginx di container ini mendengarkan port **80** (HTTP). Untuk produksi dengan domain:
- **Disarankan:** letakkan reverse proxy TLS (Caddy/Traefik/Cloudflare) di depan service `frontend`, atau
- Modifikasi `frontend/nginx.conf` + mount sertifikat, lalu expose 443.
Pastikan `APP_URL` sesuai URL publik final (dipakai untuk tautan email, redirect OAuth, CORS).

### Verifikasi pasca-deploy
```bash
curl -s https://domain.com/ready        # → {"status":"ready","database":true}
curl -sI https://domain.com/            # → cek Cache-Control: no-cache + security headers
docker compose ps                       # semua (healthy)
```

---

## 3. Backup & Disaster Recovery

### Strategi
- **Apa:** `pg_dump` full database (sumber kebenaran utama; file uploads disimpan terpisah di volume).
- **Kapan:** harian via cron (contoh di bawah).
- **Retensi:** 7 hari (konfigurabel via `KEEP_DAYS`).
- **Lokasi:** `./backups/` — ⏳ untuk produksi sungguhan, pindahkan ke object storage/offsite (rsync/rclone/S3) karena backup lokal ikut hilang jika disk rusak.

### Pemakaian
```bash
# Manual
./scripts/backup.sh

# Cron harian 02.00
0 2 * * * cd /path/ke/elearning-new && ./scripts/backup.sh >> backups/cron.log 2>&1
```

### Restore
```bash
gunzip -c backups/elearning-YYYYMMDD-HHMMSS.sql.gz | \
  docker exec -i elearning_db psql -U user -d elearning
```

---

## 4. Monitoring

| Sinyal | Cara |
|---|---|
| Liveness | `GET /health` (semua service punya Docker healthcheck) |
| Readiness | `GET /ready` — DB down → 503 → orchestrator restart |
| Log | `docker logs -f elearning_backend` (request log Hono + log error terstruktur `[error]`) |
| Email dry-run | Jika SMTP belum diset, email di-log ke console (`[email:dry-run]`) |

⏳ Rekomendasi lanjutan (bukan bloker): alerting eksternal (UptimeRobot dkk.) ke `/ready`, dan log aggregation.

---

## 5. Baseline Performa (hasil pengukuran)

### Lighthouse (headless Chrome, simulasi mobile throttled)
| Kategori | Skor |
|---|:---:|
| Performance | **96** |
| Accessibility | **100** |
| Best Practices | **100** |
| SEO | **100** |

Metrik kunci: FCP 2.0 s · LCP 2.3 s · TBT 0 ms · CLS 0 · server response < 100 ms.

### Bundle (vite build produksi)
| Chunk | Size | Gzip |
|---|---:|---:|
| vendor-react | 181.7 kB | 57.2 kB |
| vendor-router | 39.3 kB | 14.2 kB |
| vendor-query | 36.1 kB | 11.4 kB |
| index (app core) | 108.9 kB | 38.6 kB |
| CourseEditor (lazy) | 46.9 kB | 12.5 kB |
| Halaman lain | 3–33 kB | lazy per route |

### Load test (`scripts/loadtest.mjs`, 20 concurrent × 100 req, lokal)
- Throughput: **~400 req/s** · Error: **0**
- Latency: p50 27 ms · p95 89 ms · max 95 ms

```bash
# Ulangi dengan beban lebih tinggi:
CONCURRENCY=50 TOTAL=1000 node scripts/loadtest.mjs
```

---

## 6. Keputusan Arsitektur yang Ditutup

### Tabel `grades` (denormalisasi nilai)
**Keputusan: pertahankan kalkulasi dinamis; tabel `grades` tidak disinkronkan.**

Alasan:
- Endpoint `GET /courses/:id/gradebook` dan `GET /enrollments/my/grades` sudah menghitung agregasi real-time dari `quiz_attempts` + `assignment_submissions` — selalu akurat.
- Menulis denormalisasi menambah risiko inkonsistensi (trigger sync) tanpa manfaat pada skala ~500 user; query agregasi tetap ringan (index pada FK).
- Tabel `grades` dipertahankan di skema sebagai **cadangan** jika suatu saat volume attempt membuat agregasi lambat — migrasi tinggal mengisi dari data historis.

### Penyimpanan file: disk lokal (bukan S3/MinIO)
Dipertahankan untuk skala target (~500 user). Endpoint API tidak berubah; migrasi ke S3 hanya menyentuh `services/storage.ts` + volume Docker.

---

## 7. Checklist Pra-Produksi (final)

- [x] Test suite backend: 6 file / **69 test lulus** (termasuk alur kritis end-to-end di `flows.test.ts`)
- [x] Test suite frontend: 4 file / **18 test lulus**
- [x] Typecheck (`tsc`) + lint (`oxlint`) bersih di kedua sisi
- [x] Docker image produksi tanpa dev dependencies
- [x] Secrets wajib dari environment (compose menolak start jika kosong)
- [x] Backup script + retensi teruji
- [x] Load test: 0 error, p95 < 100 ms (lokal)
- [x] Lighthouse: Performance 96 / A11y 100 / BP 100 / SEO 100
- [ ] ⏳ Backup offsite (object storage) — keputusan infrastruktur
- [ ] ⏳ TLS termination di domain produksi
- [ ] ⏳ Alerting eksternal ke `/ready`
