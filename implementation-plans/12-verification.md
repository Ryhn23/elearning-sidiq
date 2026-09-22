# 12 — Verification Plan & Checklist Master

> **Kembali ke:** [Index](./00-INDEX.md)

---

## Critical User Flows (End-to-End)

### Flow 1: Student Belajar Hingga Dapat Sertifikat

```
Register → Login → Browse Catalog → Lihat Detail Kursus →
Enroll → Buka Course Player → 
  Tonton video (auto-complete setelah ≥ 80%) →
  Baca artikel (manual complete) →
  Kerjakan quiz (harus pass) →
  Submit tugas → Tugas dinilai Teacher →
Semua lesson selesai →
Auto-generate sertifikat →
Email "Sertifikat Terbit" diterima →
Download PDF → 
Verifikasi URL publik (/verify/:code) berfungsi
```

**Yang diverifikasi:**
- [ ] Register + login berhasil
- [ ] Course catalog tampil dengan data real
- [ ] Enroll berhasil + progress mulai dari 0%
- [ ] Video player berjalan + resume dari posisi terakhir
- [ ] Mark complete video (otomatis) dan artikel (manual)
- [ ] Quiz: ambil soal → jawab → lihat skor → mark lesson complete
- [ ] Assignment: upload file → grading → nilai tampil di course player
- [ ] Progress 100% → sertifikat di-generate otomatis
- [ ] Halaman `/verify/:code` tampil informasi benar (tanpa login)
- [ ] Download PDF berhasil

---

### Flow 2: Teacher Membuat Kursus Hingga Publish

```
Login (teacher) → Teacher Dashboard → "Buat Kursus Baru" →
Step 1: Isi informasi (judul, deskripsi, kategori, level, harga, thumbnail) →
Step 2: Buat 2 sections + 5 lessons berbagai tipe:
  - Lesson 1: Video (upload file 10MB+)
  - Lesson 2: Dokumen PDF (upload)
  - Lesson 3: Teks (TipTap editor)
  - Lesson 4: Zoom Link (URL + tanggal)
  - Lesson 5: Quiz (3 soal pilihan ganda)
Step 3: Setting (certificate enabled, learning outcomes) →
Step 4: Submit untuk Review →

Admin login → /admin/courses → Tab "Pending Review" →
Klik "Publish" → Confirm →
Kursus muncul di /courses (catalog publik)
```

**Yang diverifikasi:**
- [ ] Course Editor Step 1-4 tersimpan dengan benar
- [ ] Video upload berhasil, tampil di course player
- [ ] PDF upload berhasil, bisa dibuka di course player
- [ ] TipTap editor menyimpan HTML dengan benar
- [ ] Zoom widget tampil info dengan benar
- [ ] Quiz builder: soal tersimpan + bisa dikerjakan student
- [ ] Status berubah: `draft → pending_review → published`
- [ ] Kursus muncul di catalog setelah dipublish

---

### Flow 3: Google Account Bind + Login via Google

```
Login manual (existing account) →
/student/profile → Tab "Akun Google" →
Klik "Hubungkan Google" →
Redirect ke Google OAuth → Login dengan akun Google →
Callback → bind sukses → Kembali ke settings →

Logout →
Halaman Login → Klik "Login dengan Google" →
Pilih akun Google yang sama →
Callback → Login berhasil → Redirect ke dashboard
```

**Yang diverifikasi:**
- [ ] Tombol "Hubungkan Google" trigger redirect ke Google
- [ ] Setelah authorize, kembali ke settings dengan pesan sukses
- [ ] `users.google_id` tersimpan di DB
- [ ] Logout dan login via Google berhasil
- [ ] Jika Google belum bind: error message yang jelas di halaman login
- [ ] Jika Google sudah bind ke akun lain: error yang sesuai

---

### Flow 4: Admin User Management

```
Login (admin) → /admin/users →
"+ Tambah User" → Isi form (nama, email, password, role=teacher) → Submit →
User baru muncul di list →
Cari by email → Edit nama → Simpan →
Nonaktifkan user → Status berubah ke "Nonaktif" →
User yang dinonaktifkan coba login → Error "Akun tidak aktif"
```

**Yang diverifikasi:**
- [ ] CRUD user berfungsi
- [ ] Filter by role/status berfungsi
- [ ] Activate/deactivate berfungsi
- [ ] User nonaktif tidak bisa login

---

## Checklist Master Per Fase

### ✅ Fase 1 — Core Foundation

**Backend:**
- [ ] 24 tabel schema applied ke database
- [ ] Seed: admin + teacher + 5 students + 5 categories + 3 kursus (dengan sections & lessons)
- [ ] CRUD courses berfungsi (create, read, update, delete)
- [ ] CRUD sections + reorder berfungsi
- [ ] CRUD lessons + reorder berfungsi
- [ ] Enroll/unenroll berfungsi
- [ ] Mark lesson complete/uncomplete berfungsi
- [ ] Progress recalculation berfungsi (progress update di enrollments)
- [ ] Semua route terdaftar di index.ts dengan OpenAPI spec

**Frontend:**
- [ ] Design system (warna, font Inter, spacing) konsisten
- [ ] Protected routes: redirect /login jika tidak authenticated
- [ ] Role-based routing: admin → /admin, teacher → /teacher, student → /student
- [ ] Login + Register berfungsi
- [ ] Course catalog: tampil, search, filter, paginate
- [ ] Course detail: tampil kurikulum accordion
- [ ] Course player: buka lesson text & document
- [ ] Mark lesson selesai → progress bar update real-time
- [ ] Student dashboard: tampil progress kursus

---

### ✅ Fase 2 — Media & Assessment

**Backend:**
- [ ] MinIO + Redis berjalan di Docker Compose
- [ ] Upload video (max 2GB) berfungsi
- [ ] Upload dokumen/gambar berfungsi
- [ ] Signed URL untuk video berfungsi (expire 2 jam)
- [ ] File type validation via magic bytes
- [ ] CRUD assignment + submission + grading berfungsi
- [ ] Quiz: buat soal → start attempt → submit → hitung skor
- [ ] Quiz: multiple_choice, multiple_answer, true_false, short_answer, essay
- [ ] Email terkirim saat: enrollment, assignment graded

**Frontend:**
- [ ] Video player: putar video dari MinIO
- [ ] Video resume dari posisi terakhir
- [ ] Auto-complete video setelah ≥ 80% ditonton
- [ ] Speed control video (0.5x - 2x)
- [ ] Zoom widget dengan countdown
- [ ] Assignment: upload + status + lihat nilai
- [ ] Quiz: soal + timer + submit + hasil
- [ ] Course Editor: semua tipe lesson bisa dibuat
- [ ] VideoUploader dengan progress bar upload

---

### ✅ Fase 3 — Student Experience & Admin

**Backend:**
- [ ] Discussion thread + reply + pin + hapus
- [ ] Announcement: buat + notifikasi broadcast ke enrolled
- [ ] Notification: create, list, mark read, unread count
- [ ] Certificate: PDF generation + upload MinIO + simpan DB
- [ ] Auto-generate sertifikat saat progress 100%
- [ ] `GET /certificates/:code` publik berfungsi
- [ ] Grade: my grades + gradebook + CSV export
- [ ] User management: CRUD + activate/deactivate

**Frontend:**
- [ ] Discussion component di Course Player
- [ ] Announcement di student dashboard
- [ ] Notification badge + dropdown di TopNav
- [ ] `/student/my-courses` tabs + progress
- [ ] `/student/grades` accordion + final grade
- [ ] `/student/certificates` daftar sertifikat
- [ ] `/verify/:code` verifikasi publik
- [ ] `/admin/users` CRUD + bulk action
- [ ] `/admin/courses` approval workflow
- [ ] `/admin/categories` CRUD + reorder
- [ ] `/teacher/.../students` dengan progress modal
- [ ] `/teacher/.../gradebook` dengan inline grading

---

### ✅ Fase 4 — Auth Lanjut & Polish

**Backend:**
- [ ] Refresh token rotation (setiap refresh dapat token baru)
- [ ] Logout invalidate refresh token dari DB
- [ ] Google OAuth bind endpoint berfungsi
- [ ] Google login via google_id berfungsi
- [ ] Error jika google_id tidak terdaftar
- [ ] Forgot password + reset password flow lengkap
- [ ] Analytics overview: data akurat
- [ ] Rate limiting aktif di auth endpoints (test brute force)

**Frontend:**
- [ ] Axios interceptor: auto-refresh saat 401
- [ ] Token storage: refreshToken di localStorage, accessToken di Zustand
- [ ] Google bind/unbind di settings berfungsi
- [ ] `/auth/google/callback` page handler
- [ ] Forgot password flow
- [ ] Reset password flow
- [ ] Admin analytics dengan charts
- [ ] Semua fetch menggunakan TanStack Query
- [ ] Lazy loading semua halaman

**Security & Performance:**
- [ ] Lighthouse Performance ≥ 80
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Rate limiting tercegah brute force
- [ ] Upload: MIME validation via magic bytes (reject spoofed files)
- [ ] HTML: XSS sanitization berfungsi (test dengan payload)
- [ ] Nginx security headers aktif
- [ ] Docker resource limits di semua service
- [ ] `.env.example` lengkap
- [ ] `README.md` dengan instruksi setup

---

## Manual Testing Scenarios

### Scenario: Rate Limit Login

```bash
# Harusnya gagal setelah 5 percobaan
for i in {1..10}; do
  curl -X POST http://localhost:8080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -s -o /dev/null -w "Attempt $i: %{http_code}\n"
done
# Expected: 401 untuk attempt 1-5, 429 untuk attempt 6-10
```

### Scenario: File Upload MIME Validation

```bash
# Buat file .exe yang di-rename jadi .pdf
# Upload via API → harusnya reject (400)
cp /usr/bin/ls /tmp/malicious.pdf
curl -X POST http://localhost:8080/api/v1/upload/document \
  -H "Authorization: Bearer {token}" \
  -F "file=@/tmp/malicious.pdf" \
  -w "\nHTTP: %{http_code}\n"
# Expected: HTTP 400 dengan error "Tipe file tidak diizinkan"
```

### Scenario: XSS Prevention

1. Masuk ke Course Editor sebagai Teacher
2. Buka lesson tipe "Teks"
3. Di TipTap editor, inspect element dan inject: `<script>alert('XSS')</script>`
4. Save
5. Buka lesson sebagai student
6. Expected: script tidak execute (DOMPurify strip `<script>` tag)

### Scenario: Video Resume

1. Buka video lesson, tonton sampai detik ke-120 (2 menit)
2. Refresh halaman
3. Expected: video mulai dari detik ke-120 (atau ±5 detik)

---

## Monitoring & Logging

### Log yang Harus Ada di Backend

```typescript
// Minimal log yang harus dicatat:
console.info(`[AUTH] Login: userId=${user.id}, ip=${ip}`);
console.info(`[ENROLL] userId=${userId} enrolled courseId=${courseId}`);
console.warn(`[RATE_LIMIT] IP ${ip} exceeded limit on ${endpoint}`);
console.error(`[UPLOAD] Failed: ${error.message}`, { userId, fileKey });
console.error(`[EMAIL] Failed to send: ${error.message}`, { to, template });
```

### Health Check Endpoint

```typescript
// GET /health — tidak perlu auth
app.get('/health', async (c) => {
  const dbOk = await db.execute(sql`SELECT 1`).then(() => true).catch(() => false);
  const redisOk = await redis.ping().then(r => r === 'PONG').catch(() => false);
  
  return c.json({
    status: dbOk && redisOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: { database: dbOk, redis: redisOk },
  }, dbOk && redisOk ? 200 : 503);
});
```
