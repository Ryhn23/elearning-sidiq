# 03 — Backend API: Routes & Endpoint

> **Kembali ke:** [Index](./00-INDEX.md)  
> **Base URL:** `/api/v1`  
> **Auth:** ✅ = wajib Bearer token | ❌ = publik

---

## Ringkasan Semua Route Groups

| Group | Base Path | Fase | Jumlah Endpoint |
|---|---|:---:|---|
| Auth | `/auth` | 1 + 4 | 14 endpoint |
| Users | `/users` | 3 | 7 endpoint |
| Categories | `/categories` | 1 | 4 endpoint |
| Courses | `/courses` | 1 | 13 endpoint |
| Sections | `/courses/:id/sections` | 1 | 5 endpoint |
| Lessons | `/sections/:id/lessons` | 1 | 9 endpoint |
| Enrollments | `/enrollments` | 1 | 6 endpoint |
| Assignments | `/assignments` | 2 | 6 endpoint |
| Quizzes | `/quizzes` | 2 | 11 endpoint |
| Upload | `/upload` | 2 | 5 endpoint |
| Discussions | `/discussions` | 3 | 8 endpoint |
| Grades | `/grades` | 3 | 4 endpoint |
| Notifications | `/notifications` | 3 | 5 endpoint |
| Certificates | `/certificates` | 3 | 3 endpoint |
| Analytics | `/analytics` | 4 | 3 endpoint |
| Announcements | `/announcements` | 3 | 4 endpoint |

---

## Auth (`/api/v1/auth`) — Fase 1 + 4

### Endpoint Fase 1 (Login & Basic)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/register` | ❌ | Daftar akun baru (name, email, password, role) |
| POST | `/login` | ❌ | Login → return `{ accessToken, refreshToken, user }` |
| GET | `/me` | ✅ | Get profil user yang sedang login |
| PUT | `/me` | ✅ | Update profil (name, bio, phone, avatarUrl) |
| PUT | `/me/password` | ✅ | Ganti password (wajib kirim currentPassword) |

### Endpoint Fase 4 (Google OAuth + Token Rotation)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/refresh` | ❌ | Tukar refresh token → new access token + new refresh token |
| POST | `/logout` | ✅ | Blacklist refresh token |
| POST | `/me/google/bind` | ✅ | Mulai bind Google → return `{ authUrl }` |
| GET | `/me/google/callback` | ❌ | OAuth callback → simpan google_id ke user |
| DELETE | `/me/google/unbind` | ✅ | Lepas bind Google (hapus google_id) |
| GET | `/google/login` | ❌ | Login via Google (hanya jika sudah bind) |
| GET | `/google/callback` | ❌ | OAuth callback → cari user by google_id → JWT |
| POST | `/forgot-password` | ❌ | Request reset link via email |
| POST | `/reset-password` | ❌ | Submit `{ token, newPassword }` |

**Detail Response Login:**
```json
{
  "accessToken": "eyJhbGci...",     // expire 15 menit
  "refreshToken": "eyJhbGci...",    // expire 7 hari
  "user": {
    "id": "uuid",
    "name": "...",
    "email": "...",
    "role": "student",
    "avatarUrl": null
  }
}
```

---

## Users (`/api/v1/users`) — Fase 3, Admin Only

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/` | List semua user dengan `?search=&role=&status=&page=&limit=` |
| GET | `/:id` | Detail user |
| POST | `/` | Buat user baru (admin create manual) |
| PUT | `/:id` | Edit user (name, role, isActive) |
| PATCH | `/:id/activate` | Set `isActive = true` |
| PATCH | `/:id/deactivate` | Set `isActive = false` |
| GET | `/:id/enrollments` | Daftar kursus yang diikuti user |

---

## Categories (`/api/v1/categories`) — Fase 1

| Method | Path | Auth | Role | Deskripsi |
|---|---|---|---|---|
| GET | `/` | ❌ | — | List semua kategori (ordered by sortOrder) |
| POST | `/` | ✅ | admin | Buat kategori baru |
| PUT | `/:id` | ✅ | admin | Edit kategori |
| DELETE | `/:id` | ✅ | admin | Hapus kategori |

---

## Courses (`/api/v1/courses`) — Fase 1

| Method | Path | Auth | Role | Deskripsi |
|---|---|---|---|---|
| GET | `/` | ❌ | — | Catalog: list kursus published |
| GET | `/my` | ✅ | teacher | Kursus milik teacher yang login |
| GET | `/:id` | ❌ | — | Detail kursus publik (tanpa konten lesson) |
| GET | `/:id/full` | ✅ | enrolled/teacher/admin | Detail + konten lengkap |
| POST | `/` | ✅ | teacher/admin | Buat kursus baru |
| PUT | `/:id` | ✅ | owner/admin | Edit kursus |
| DELETE | `/:id` | ✅ | owner/admin | Hapus kursus |
| PATCH | `/:id/submit` | ✅ | owner | Submit untuk review (draft → pending_review) |
| PATCH | `/:id/publish` | ✅ | admin | Approve & publish |
| PATCH | `/:id/archive` | ✅ | owner/admin | Arsipkan |
| GET | `/:id/students` | ✅ | teacher/admin | List student yang enrolled |
| GET | `/:id/analytics` | ✅ | teacher/admin | Stats kursus |
| GET | `/:id/gradebook` | ✅ | teacher/admin | Nilai semua student |

**Query Params GET `/courses` (Catalog):**
```
?search=javascript   cari judul atau deskripsi
?category=web-dev    filter by category slug
?level=beginner      beginner|intermediate|advanced|all_levels
?language=id         id|en
?sort=newest         newest|rating|popular
?page=1              default: 1
?limit=12            default: 12, max: 50
```

---

## Sections (`/api/v1/courses/:courseId/sections`) — Fase 1

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/` | ✅ | List sections + lesson metadata (tanpa konten) |
| POST | `/` | ✅ owner/admin | Buat section baru |
| PUT | `/:sectionId` | ✅ owner/admin | Edit section (title, description, isVisible) |
| DELETE | `/:sectionId` | ✅ owner/admin | Hapus section + cascade ke lessons |
| PATCH | `/reorder` | ✅ owner/admin | Ubah urutan: `{ order: ["uuid1", "uuid2"] }` |

---

## Lessons (`/api/v1/sections/:sectionId/lessons`) — Fase 1

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/` | ✅ owner/admin | Buat lesson baru (title, type, sortOrder) |
| GET | `/:lessonId` | ✅ enrolled/owner/admin | Get lesson + konten (lesson_contents) |
| PUT | `/:lessonId` | ✅ owner/admin | Edit metadata lesson |
| PUT | `/:lessonId/content` | ✅ owner/admin | Update konten lesson |
| DELETE | `/:lessonId` | ✅ owner/admin | Hapus lesson |
| PATCH | `/reorder` | ✅ owner/admin | Ubah urutan lesson dalam section |
| POST | `/:lessonId/complete` | ✅ enrolled | Tandai lesson selesai |
| DELETE | `/:lessonId/complete` | ✅ enrolled | Batalkan completion |
| PATCH | `/:lessonId/video-position` | ✅ enrolled | Simpan posisi video: `{ positionSec: 120 }` |

**Body POST `/` (Buat Lesson):**
```json
{
  "title": "Intro to Python",
  "type": "video",
  "sortOrder": 0,
  "isFreePreview": false,
  "durationMinutes": 15
}
```

**Body PUT `/:lessonId/content` untuk tipe video:**
```json
{
  "videoUrl": "https://minio.../uuid.mp4",
  "videoDurationSec": 900,
  "videoSizeBytes": 125000000
}
```

---

## Enrollments (`/api/v1/enrollments`) — Fase 1

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/courses/:courseId` | ✅ | Enroll ke kursus |
| DELETE | `/courses/:courseId` | ✅ | Keluar dari kursus |
| GET | `/my` | ✅ | List kursus yang diikuti sendiri (+ progress) |
| GET | `/my/:courseId/progress` | ✅ | Progress detail: lesson mana yang sudah selesai |
| POST | `/admin/courses/:courseId/users/:userId` | ✅ admin | Enroll user secara manual |
| PATCH | `/admin/:enrollmentId/suspend` | ✅ admin | Suspend/aktifkan enrollment |

---

## Assignments (`/api/v1/assignments`) — Fase 2

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/lessons/:lessonId` | ✅ owner/admin | Buat assignment untuk lesson |
| PUT | `/:assignmentId` | ✅ owner/admin | Edit (dueDate, maxScore, allowedFileTypes) |
| GET | `/:assignmentId/submissions` | ✅ teacher/admin | List semua submission + status |
| POST | `/:assignmentId/submit` | ✅ enrolled | Submit tugas (body: fileUrl dari upload) |
| GET | `/:assignmentId/my-submission` | ✅ enrolled | Lihat submission + nilai sendiri |
| PATCH | `/submissions/:submissionId/grade` | ✅ teacher/admin | Nilai: `{ score, feedback }` |

**Body POST `/submit`:**
```json
{
  "fileUrl": "https://minio.../submission-uuid.pdf",
  "fileName": "tugas-saya.pdf",
  "fileSizeBytes": 204800,
  "notes": "Ini jawaban tugas minggu 1"
}
```

---

## Quizzes (`/api/v1/quizzes`) — Fase 2

### Management (Teacher/Admin)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/lessons/:lessonId` | ✅ owner/admin | Buat quiz (setting: timeLimitMin, maxAttempts, passingScore) |
| PUT | `/:quizId` | ✅ owner/admin | Edit setting quiz |
| POST | `/:quizId/questions` | ✅ owner/admin | Tambah soal |
| PUT | `/:quizId/questions/:questionId` | ✅ owner/admin | Edit soal |
| DELETE | `/:quizId/questions/:questionId` | ✅ owner/admin | Hapus soal |
| PATCH | `/:quizId/questions/reorder` | ✅ owner/admin | Ubah urutan soal |
| GET | `/:quizId/attempts` | ✅ teacher/admin | Semua attempt dari semua student |

### Taking Quiz (Student)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/:quizId/start` | ✅ enrolled | Mulai attempt → return `{ attemptId, questions, timeLimitSec }` |
| POST | `/attempts/:attemptId/submit` | ✅ enrolled | Submit semua jawaban sekaligus |
| GET | `/attempts/:attemptId/result` | ✅ | Hasil: skor, jawaban benar/salah, isPassed |
| GET | `/:quizId/my-attempts` | ✅ enrolled | Riwayat attempt sendiri |

**Body POST `/start`:** Kosong (tidak ada body)  
**Response POST `/start`:**
```json
{
  "attemptId": "uuid",
  "timeLimitSec": 1800,
  "startedAt": "2026-09-05T...",
  "questions": [
    {
      "id": "uuid",
      "type": "multiple_choice",
      "questionText": "Apa itu...",
      "imageUrl": null,
      "points": 1,
      "options": [
        { "id": "uuid", "optionText": "A. ..." },
        { "id": "uuid", "optionText": "B. ..." }
      ]
      // isCorrect tidak dikirim ke student
    }
  ]
}
```

**Body POST `/attempts/:id/submit`:**
```json
{
  "answers": [
    { "questionId": "uuid", "selectedOptionIds": ["uuid-option-b"] },
    { "questionId": "uuid", "textAnswer": "Jawaban essay saya" }
  ]
}
```

**Response POST `/submit` (jika showResultImmediately=true):**
```json
{
  "attemptId": "uuid",
  "score": 8,
  "maxScore": 10,
  "percentage": 80,
  "isPassed": true,
  "timeTakenSec": 1200,
  "answers": [
    { "questionId": "uuid", "isCorrect": true, "pointsEarned": 1 }
  ]
}
```

---

## Upload (`/api/v1/upload`) — Fase 2

| Method | Path | Auth | Role | Max Size | Deskripsi |
|---|---|---|---|---|---|
| POST | `/video` | ✅ | teacher/admin | 2GB | Upload video (multipart/form-data) |
| POST | `/document` | ✅ | teacher/admin | 50MB | Upload PDF/file |
| POST | `/image` | ✅ | any | 5MB | Upload gambar (thumbnail, avatar) |
| POST | `/assignment` | ✅ | student | 50MB | Upload file tugas |
| GET | `/signed-url?fileKey=...` | ✅ | enrolled/owner | — | Presigned URL streaming (expire 2 jam) |

**Response Upload:**
```json
{
  "url": "https://minio.example.com/elearning/videos/abc123.mp4",
  "fileKey": "videos/abc123.mp4",
  "fileName": "intro-python.mp4",
  "sizeBytes": 125000000,
  "mimeType": "video/mp4"
}
```

---

## Discussions (`/api/v1/discussions`) — Fase 3

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/courses/:courseId` | ✅ enrolled/teacher/admin | List thread diskusi kursus |
| GET | `/lessons/:lessonId` | ✅ enrolled/teacher/admin | Thread diskusi per lesson |
| POST | `/courses/:courseId` | ✅ enrolled/teacher/admin | Buat thread baru |
| GET | `/:discussionId` | ✅ enrolled/teacher/admin | Detail thread + replies |
| POST | `/:discussionId/replies` | ✅ enrolled/teacher/admin | Balas thread |
| PUT | `/:discussionId` | ✅ author/admin | Edit thread |
| DELETE | `/:discussionId` | ✅ author/teacher/admin | Hapus thread |
| PATCH | `/:discussionId/pin` | ✅ teacher/admin | Toggle pin |

---

## Grades (`/api/v1/grades`) — Fase 3

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/my` | ✅ | Nilai semua kursus yang diikuti student |
| GET | `/my/courses/:courseId` | ✅ | Detail nilai di kursus tertentu |
| GET | `/courses/:courseId` | ✅ teacher/admin | Gradebook kursus (semua student) |
| GET | `/courses/:courseId/export` | ✅ teacher/admin | Export gradebook sebagai CSV |

---

## Notifications (`/api/v1/notifications`) — Fase 3

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/` | ✅ | List notifikasi user (max 50 terbaru) |
| GET | `/unread-count` | ✅ | `{ count: 5 }` — untuk badge di TopNav |
| PATCH | `/:id/read` | ✅ | Tandai 1 notifikasi sudah dibaca |
| PATCH | `/read-all` | ✅ | Tandai semua dibaca |
| DELETE | `/:id` | ✅ | Hapus notifikasi |

---

## Certificates (`/api/v1/certificates`) — Fase 3

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/my` | ✅ | Semua sertifikat milik user yang login |
| GET | `/:code` | ❌ | Verifikasi publik by kode unik (tanpa login) |
| POST | `/courses/:courseId/generate` | ✅ | Manual generate (auto jika kursus selesai) |

**Response GET `/:code` (verifikasi publik):**
```json
{
  "isValid": true,
  "holderName": "Budi Santoso",
  "courseName": "Python untuk Pemula",
  "instructorName": "Dr. Ani",
  "issuedAt": "2026-08-01T00:00:00Z",
  "pdfUrl": "https://minio.../cert-abc123.pdf"
}
```

---

## Analytics (`/api/v1/analytics`) — Fase 4

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/overview` | ✅ admin | Stats global platform |
| GET | `/courses/:courseId` | ✅ teacher/admin | Stats per kursus |
| GET | `/courses/:courseId/completion-funnel` | ✅ teacher/admin | Funnel per section |

**Response GET `/overview`:**
```json
{
  "totalUsers": 487,
  "totalStudents": 450,
  "totalTeachers": 35,
  "totalAdmins": 2,
  "totalCourses": 42,
  "publishedCourses": 38,
  "totalEnrollments": 1520,
  "activeEnrollmentsThisMonth": 89,
  "completionRate": 67.5
}
```

---

## Announcements (`/api/v1/announcements`) — Fase 3

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/courses/:courseId` | ✅ enrolled/owner/admin | List pengumuman kursus |
| POST | `/courses/:courseId` | ✅ teacher/admin | Buat pengumuman baru |
| PUT | `/:id` | ✅ author/admin | Edit pengumuman |
| DELETE | `/:id` | ✅ author/admin | Hapus pengumuman |

---

## Konvensi Error Response

```json
{
  "error": "Deskripsi error yang jelas",
  "code": "VALIDATION_ERROR",      // opsional, machine-readable code
  "details": { ... }               // opsional, detail validasi Zod
}
```

| HTTP Status | Kasus |
|---|---|
| 400 | Validasi gagal (Zod error) |
| 401 | Tidak ada token / token expired |
| 403 | Role tidak punya akses |
| 404 | Resource tidak ditemukan |
| 409 | Conflict (email sudah terdaftar, dll) |
| 429 | Rate limit tercapai |
| 500 | Server error |
