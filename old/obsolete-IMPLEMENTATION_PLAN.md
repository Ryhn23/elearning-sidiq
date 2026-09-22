#E-Learning Platform — Implementation Plan (Berstandar Internasional)

> **⚠️ DOKUMEN INI TELAH DIPECAH MENJADI FILE-FILE MODULAR**  
> Silakan gunakan folder [`docs/`](./docs/00-INDEX.md) untuk navigasi yang lebih mudah.  
> File ini dipertahankan sebagai referensi monolitik (arsip).



> **Versi:** 1.0  
> **Tanggal:** September 2026  
> **Skala Target:** ~500 pengguna aktif  
> **Referensi UX/Fitur:** Moodle LMS  
> **Stack:** Hono.js + Drizzle ORM + PostgreSQL + React 19 + TailwindCSS v4

---

## Daftar Isi

1. [Analisis Codebase Saat Ini](#1-analisis-codebase-saat-ini)
2. [Konteks & Keputusan Arsitektur](#2-konteks--keputusan-arsitektur)
3. [Struktur Platform (Moodle-inspired)](#3-struktur-platform-moodle-inspired)
4. [Database Schema Lengkap](#4-database-schema-lengkap)
5. [Backend API — Routes & Endpoint](#5-backend-api--routes--endpoint)
6. [Frontend — Pages & Components](#6-frontend--pages--components)
7. [Infrastruktur & DevOps](#7-infrastruktur--devops)
8. [Keamanan](#8-keamanan)
9. [Rencana Implementasi Bertahap (8 Minggu)](#9-rencana-implementasi-bertahap-8-minggu)
10. [Struktur Direktori Target](#10-struktur-direktori-target)
11. [Dependency Tambahan](#11-dependency-tambahan)
12. [Verification Plan](#12-verification-plan)

---

## 1. Analisis Codebase Saat Ini

### Yang Sudah Ada

| File | Deskripsi | Status |
|---|---|---|
| `backend/src/db/schema.ts` | Schema `users` + `courses` dasar | Perlu ekspansi besar |
| `backend/src/db/index.ts` | Koneksi Drizzle + postgres.js | Solid, tidak diubah |
| `backend/src/index.ts` | Hono server + Swagger UI + CORS | Solid, perlu register routes baru |
| `backend/src/routes/auth.ts` | Register, Login, /me | Perlu tambah OAuth Google |
| `backend/src/routes/course.ts` | GET /courses saja | Perlu CRUD lengkap |
| `backend/src/middleware/jwt.ts` | authMiddleware + roleMiddleware | Solid, tidak diubah |
| `backend/seed.ts` | Seed admin user | Perlu diperluas |
| `frontend/src/store/authStore.ts` | Zustand auth state | Perlu tambah google auth |
| `frontend/src/lib/api.ts` | Axios instance + interceptors | Solid, tidak diubah |
| `frontend/src/App.tsx` | Router + ProtectedRoute | Perlu routing lengkap |
| `frontend/src/pages/Login.tsx` | Form login dasar | Perlu redesign |
| `frontend/src/pages/Dashboard.tsx` | Placeholder kosong | Di-replace per role |
| `docker-compose.yml` | DB + Backend + Frontend | Perlu tambah Redis + MinIO |
| `frontend/nginx.conf` | Reverse proxy ke backend | Perlu security headers |

### Gap Kritis

```
Database  : 2 tabel   → target 24 tabel
API       : 4 endpoint → target 60+ endpoint
Frontend  : 2 halaman  → target 20+ halaman
Media     : Tidak ada  → MinIO S3 object storage
Auth      : JWT manual → + Google OAuth bind
```

---

## 2. Konteks & Keputusan Arsitektur

### Skala: ~500 Pengguna

- **Single-server Docker Compose** sudah cukup, tidak perlu Kubernetes
- **Redis** dipakai untuk: cache API responses, blacklist refresh token
- **Tidak perlu** message queue (Bull/RabbitMQ) untuk skala ini
- **PostgreSQL connection pool**: max 20 connections sudah cukup
- **MinIO** single-node untuk object storage (video, PDF, gambar, sertifikat PDF)

### Referensi: Moodle LMS

Platform mengadopsi konsep inti Moodle:

```
MOODLE CONCEPT          IMPLEMENTASI KITA
────────────────────────────────────────────
Course                  Course (kursus)
Section/Topic           CourseSection (bab/topik)
Activity                Lesson (aktivitas dalam bab)
Resource (File/URL)     LessonContent type: video|document|url|text
Assignment              Assignment (tugas dengan upload file)
Quiz                    Quiz (ujian pilihan ganda/essay)
Forum                   Discussion (diskusi per kursus/lesson)
Gradebook               Grade (rekap nilai)
Completion Tracking     LessonProgress + Enrollment.progress
Enrollment              Enrollment (manual/self-enroll)
```

### Autentikasi: Local + Google Bind

**Alur normal:** Email + Password → JWT

**Alur Google Bind:**
1. User sudah punya akun lokal dengan email + password
2. Di Settings → klik "Hubungkan dengan Google"
3. Redirect ke Google OAuth → dapat `google_id` + `google_email`
4. Backend simpan ke `users.google_id`
5. Selanjutnya bisa login via tombol "Login dengan Google"
6. Google callback → cari user by `google_id` → issue JWT

**PENTING:** User tidak bisa registrasi langsung via Google. Wajib buat akun lokal dulu.

### Mode Pembelajaran: Async + Zoom untuk Live

- Konten: Video upload, PDF/dokumen, teks/artikel, link eksternal (termasuk Zoom)
- Tidak ada fitur WebRTC/video conference bawaan
- Lesson berjenis `zoom_link`: simpan URL meeting + jadwal → tampilkan info + countdown

---

## 3. Struktur Platform (Moodle-inspired)

### Hirarki Konten

```
Platform
└── Course (Kursus)
    ├── Meta: judul, deskripsi, thumbnail, level, status
    ├── Instructor (FK → users)
    ├── Category
    └── CourseSection[] (Bab/Topik, berurutan)
        └── Lesson[] (Aktivitas, berurutan)
            ├── type: video       → URL video dari MinIO
            ├── type: document    → URL PDF/file dari MinIO
            ├── type: text        → Rich text (HTML)
            ├── type: zoom_link   → URL Zoom + datetime
            ├── type: assignment  → Tugas (upload file oleh student)
            └── type: quiz        → Soal pilihan ganda/essay
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
| Buat user | ✅ | ❌ | ❌ |
| Analytics global | ✅ | ❌ | ❌ |
| Analytics kursusnya | ✅ | ✅ | ❌ |

---

## 4. Database Schema Lengkap

Semua tabel: UUID primary key + `created_at`/`updated_at` timestamp.

### File: `backend/src/db/schema.ts` (Full Rewrite)

```typescript
// ============================================================
// ENUMS
// ============================================================

export const roleEnum = pgEnum('role', ['admin', 'teacher', 'student']);
export const courseLevelEnum = pgEnum('course_level', ['beginner', 'intermediate', 'advanced', 'all_levels']);
export const courseStatusEnum = pgEnum('course_status', ['draft', 'pending_review', 'published', 'archived']);
export const lessonTypeEnum = pgEnum('lesson_type', ['video', 'document', 'text', 'zoom_link', 'assignment', 'quiz']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['submitted', 'graded', 'revision_requested', 'late']);
export const questionTypeEnum = pgEnum('question_type', ['multiple_choice', 'multiple_answer', 'true_false', 'short_answer', 'essay']);
export const notificationTypeEnum = pgEnum('notification_type', ['enrollment', 'new_content', 'assignment_graded', 'quiz_result', 'announcement', 'discussion_reply', 'zoom_reminder']);
export const enrollmentStatusEnum = pgEnum('enrollment_status', ['active', 'completed', 'suspended']);

// ============================================================
// TABEL 1: users (EXPAND dari versi saat ini)
// ============================================================
export const users = pgTable('users', {
  id:           uuid('id').defaultRandom().primaryKey(),
  name:         varchar('name', { length: 255 }).notNull(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),    // nullable (future: pure Google)
  role:         roleEnum('role').default('student').notNull(),
  googleId:     varchar('google_id', { length: 255 }).unique(), // dari Google OAuth bind
  googleEmail:  varchar('google_email', { length: 255 }),
  avatarUrl:    text('avatar_url'),
  bio:          text('bio'),
  phone:        varchar('phone', { length: 20 }),
  isActive:     boolean('is_active').default(true).notNull(),
  lastLoginAt:  timestamp('last_login_at'),
  createdAt:    timestamp('created_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 2: categories
// ============================================================
export const categories = pgTable('categories', {
  id:          uuid('id').defaultRandom().primaryKey(),
  name:        varchar('name', { length: 100 }).notNull(),
  slug:        varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  iconUrl:     text('icon_url'),
  sortOrder:   integer('sort_order').default(0),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ============================================================
// TABEL 3: courses (EXPAND dari versi saat ini)
// ============================================================
export const courses = pgTable('courses', {
  id:                 uuid('id').defaultRandom().primaryKey(),
  slug:               varchar('slug', { length: 300 }).notNull().unique(),
  title:              varchar('title', { length: 255 }).notNull(),
  description:        text('description'),
  shortDescription:   varchar('short_description', { length: 500 }),
  thumbnailUrl:       text('thumbnail_url'),
  previewVideoUrl:    text('preview_video_url'),
  instructorId:       uuid('instructor_id').notNull().references(() => users.id),
  categoryId:         uuid('category_id').references(() => categories.id),
  level:              courseLevelEnum('level').default('all_levels'),
  status:             courseStatusEnum('status').default('draft').notNull(),
  language:           varchar('language', { length: 10 }).default('id'),
  estimatedHours:     integer('estimated_hours'),
  price:              integer('price').default(0),              // Rupiah, 0=gratis
  learningOutcomes:   text('learning_outcomes').array(),
  requirements:       text('requirements').array(),
  tags:               text('tags').array(),
  certificateEnabled: boolean('certificate_enabled').default(false),
  totalEnrolled:      integer('total_enrolled').default(0),    // denormalized
  averageRating:      real('average_rating').default(0),
  totalReviews:       integer('total_reviews').default(0),
  publishedAt:        timestamp('published_at'),
  createdAt:          timestamp('created_at').defaultNow(),
  updatedAt:          timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 4: course_sections
// ============================================================
export const courseSections = pgTable('course_sections', {
  id:          uuid('id').defaultRandom().primaryKey(),
  courseId:    uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title:       varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  sortOrder:   integer('sort_order').default(0).notNull(),
  isVisible:   boolean('is_visible').default(true),
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 5: lessons
// ============================================================
export const lessons = pgTable('lessons', {
  id:              uuid('id').defaultRandom().primaryKey(),
  sectionId:       uuid('section_id').notNull().references(() => courseSections.id, { onDelete: 'cascade' }),
  title:           varchar('title', { length: 255 }).notNull(),
  type:            lessonTypeEnum('type').notNull(),
  sortOrder:       integer('sort_order').default(0).notNull(),
  isVisible:       boolean('is_visible').default(true),
  isFreePreview:   boolean('is_free_preview').default(false),
  durationMinutes: integer('duration_minutes'),
  createdAt:       timestamp('created_at').defaultNow(),
  updatedAt:       timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 6: lesson_contents
// Dipisah dari lessons agar query list lesson ringan
// ============================================================
export const lessonContents = pgTable('lesson_contents', {
  id:                     uuid('id').defaultRandom().primaryKey(),
  lessonId:               uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }).unique(),
  // type: video
  videoUrl:               text('video_url'),
  videoDurationSec:       integer('video_duration_sec'),
  videoSizeBytes:         bigint('video_size_bytes', { mode: 'number' }),
  // type: document
  documentUrl:            text('document_url'),
  documentName:           varchar('document_name', { length: 255 }),
  documentSizeBytes:      bigint('document_size_bytes', { mode: 'number' }),
  // type: text
  textContent:            text('text_content'),                // HTML dari rich text editor
  // type: zoom_link
  zoomUrl:                text('zoom_url'),
  zoomMeetingId:          varchar('zoom_meeting_id', { length: 100 }),
  zoomStartAt:            timestamp('zoom_start_at'),
  zoomDurationMin:        integer('zoom_duration_min'),
  // type: assignment
  assignmentInstructions: text('assignment_instructions'),
  // type: quiz — detail ada di tabel quizzes (relasi via lessonId)
  createdAt:              timestamp('created_at').defaultNow(),
  updatedAt:              timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 7: enrollments
// ============================================================
export const enrollments = pgTable('enrollments', {
  id:          uuid('id').defaultRandom().primaryKey(),
  userId:      uuid('user_id').notNull().references(() => users.id),
  courseId:    uuid('course_id').notNull().references(() => courses.id),
  status:      enrollmentStatusEnum('status').default('active').notNull(),
  progress:    real('progress').default(0),                    // 0.0 - 100.0
  completedAt: timestamp('completed_at'),
  enrolledAt:  timestamp('enrolled_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
}, (t) => ({ uniq: unique().on(t.userId, t.courseId) }));

// ============================================================
// TABEL 8: lesson_progress
// ============================================================
export const lessonProgress = pgTable('lesson_progress', {
  id:            uuid('id').defaultRandom().primaryKey(),
  userId:        uuid('user_id').notNull().references(() => users.id),
  lessonId:      uuid('lesson_id').notNull().references(() => lessons.id),
  courseId:      uuid('course_id').notNull().references(() => courses.id),
  isCompleted:   boolean('is_completed').default(false).notNull(),
  videoPosition: integer('video_position').default(0),         // detik, untuk resume
  completedAt:   timestamp('completed_at'),
  lastAccessAt:  timestamp('last_access_at').defaultNow(),
}, (t) => ({ uniq: unique().on(t.userId, t.lessonId) }));

// ============================================================
// TABEL 9: assignments
// ============================================================
export const assignments = pgTable('assignments', {
  id:               uuid('id').defaultRandom().primaryKey(),
  lessonId:         uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }).unique(),
  dueDate:          timestamp('due_date'),
  maxScore:         integer('max_score').default(100),
  allowedFileTypes: text('allowed_file_types').array(),        // ['pdf','docx','zip']
  maxFileSizeMb:    integer('max_file_size_mb').default(10),
  createdAt:        timestamp('created_at').defaultNow(),
  updatedAt:        timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 10: assignment_submissions
// ============================================================
export const assignmentSubmissions = pgTable('assignment_submissions', {
  id:            uuid('id').defaultRandom().primaryKey(),
  assignmentId:  uuid('assignment_id').notNull().references(() => assignments.id),
  userId:        uuid('user_id').notNull().references(() => users.id),
  fileUrl:       text('file_url').notNull(),
  fileName:      varchar('file_name', { length: 255 }),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  notes:         text('notes'),
  status:        assignmentStatusEnum('status').default('submitted'),
  score:         real('score'),
  feedback:      text('feedback'),
  gradedById:    uuid('graded_by_id').references(() => users.id),
  gradedAt:      timestamp('graded_at'),
  submittedAt:   timestamp('submitted_at').defaultNow(),
}, (t) => ({ uniq: unique().on(t.assignmentId, t.userId) }));

// ============================================================
// TABEL 11: quizzes
// ============================================================
export const quizzes = pgTable('quizzes', {
  id:                    uuid('id').defaultRandom().primaryKey(),
  lessonId:              uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }).unique(),
  timeLimitMin:          integer('time_limit_min'),
  maxAttempts:           integer('max_attempts').default(3),
  passingScore:          integer('passing_score').default(70),
  shuffleQuestions:      boolean('shuffle_questions').default(false),
  shuffleOptions:        boolean('shuffle_options').default(false),
  showResultImmediately: boolean('show_result_immediately').default(true),
  createdAt:             timestamp('created_at').defaultNow(),
  updatedAt:             timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 12: quiz_questions
// ============================================================
export const quizQuestions = pgTable('quiz_questions', {
  id:           uuid('id').defaultRandom().primaryKey(),
  quizId:       uuid('quiz_id').notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  type:         questionTypeEnum('type').notNull(),
  questionText: text('question_text').notNull(),
  imageUrl:     text('image_url'),
  points:       real('points').default(1),
  sortOrder:    integer('sort_order').default(0),
  explanation:  text('explanation'),                           // penjelasan jawaban benar
  createdAt:    timestamp('created_at').defaultNow(),
});

// ============================================================
// TABEL 13: quiz_options
// ============================================================
export const quizOptions = pgTable('quiz_options', {
  id:         uuid('id').defaultRandom().primaryKey(),
  questionId: uuid('question_id').notNull().references(() => quizQuestions.id, { onDelete: 'cascade' }),
  optionText: text('option_text').notNull(),
  isCorrect:  boolean('is_correct').default(false).notNull(),
  sortOrder:  integer('sort_order').default(0),
});

// ============================================================
// TABEL 14: quiz_attempts
// ============================================================
export const quizAttempts = pgTable('quiz_attempts', {
  id:            uuid('id').defaultRandom().primaryKey(),
  quizId:        uuid('quiz_id').notNull().references(() => quizzes.id),
  userId:        uuid('user_id').notNull().references(() => users.id),
  attemptNumber: integer('attempt_number').notNull(),
  score:         real('score'),
  maxScore:      real('max_score'),
  percentage:    real('percentage'),
  isPassed:      boolean('is_passed'),
  startedAt:     timestamp('started_at').defaultNow(),
  submittedAt:   timestamp('submitted_at'),
  timeTakenSec:  integer('time_taken_sec'),
});

// ============================================================
// TABEL 15: quiz_answers
// ============================================================
export const quizAnswers = pgTable('quiz_answers', {
  id:                uuid('id').defaultRandom().primaryKey(),
  attemptId:         uuid('attempt_id').notNull().references(() => quizAttempts.id, { onDelete: 'cascade' }),
  questionId:        uuid('question_id').notNull().references(() => quizQuestions.id),
  selectedOptionIds: uuid('selected_option_ids').array(),
  textAnswer:        text('text_answer'),
  isCorrect:         boolean('is_correct'),
  pointsEarned:      real('points_earned'),
});

// ============================================================
// TABEL 16: grades (denormalized rekap nilai)
// ============================================================
export const grades = pgTable('grades', {
  id:                  uuid('id').defaultRandom().primaryKey(),
  userId:              uuid('user_id').notNull().references(() => users.id),
  courseId:            uuid('course_id').notNull().references(() => courses.id),
  quizAverage:         real('quiz_average'),
  assignmentAverage:   real('assignment_average'),
  finalGrade:          real('final_grade'),
  letterGrade:         varchar('letter_grade', { length: 5 }),
  updatedAt:           timestamp('updated_at').defaultNow(),
}, (t) => ({ uniq: unique().on(t.userId, t.courseId) }));

// ============================================================
// TABEL 17: course_reviews
// ============================================================
export const courseReviews = pgTable('course_reviews', {
  id:        uuid('id').defaultRandom().primaryKey(),
  courseId:  uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id),
  rating:    integer('rating').notNull(),                      // 1-5
  review:    text('review'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({ uniq: unique().on(t.courseId, t.userId) }));

// ============================================================
// TABEL 18: discussions
// ============================================================
export const discussions = pgTable('discussions', {
  id:         uuid('id').defaultRandom().primaryKey(),
  courseId:   uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  lessonId:   uuid('lesson_id').references(() => lessons.id),  // null=diskusi umum kursus
  userId:     uuid('user_id').notNull().references(() => users.id),
  title:      varchar('title', { length: 255 }).notNull(),
  body:       text('body').notNull(),
  isPinned:   boolean('is_pinned').default(false),
  replyCount: integer('reply_count').default(0),
  createdAt:  timestamp('created_at').defaultNow(),
  updatedAt:  timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 19: discussion_replies
// ============================================================
export const discussionReplies = pgTable('discussion_replies', {
  id:           uuid('id').defaultRandom().primaryKey(),
  discussionId: uuid('discussion_id').notNull().references(() => discussions.id, { onDelete: 'cascade' }),
  userId:       uuid('user_id').notNull().references(() => users.id),
  body:         text('body').notNull(),
  createdAt:    timestamp('created_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 20: announcements
// ============================================================
export const announcements = pgTable('announcements', {
  id:        uuid('id').defaultRandom().primaryKey(),
  courseId:  uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  authorId:  uuid('author_id').notNull().references(() => users.id),
  title:     varchar('title', { length: 255 }).notNull(),
  body:      text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 21: notifications
// ============================================================
export const notifications = pgTable('notifications', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull().references(() => users.id),
  type:      notificationTypeEnum('type').notNull(),
  title:     varchar('title', { length: 255 }).notNull(),
  body:      text('body'),
  link:      text('link'),
  isRead:    boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// TABEL 22: certificates
// ============================================================
export const certificates = pgTable('certificates', {
  id:       uuid('id').defaultRandom().primaryKey(),
  userId:   uuid('user_id').notNull().references(() => users.id),
  courseId: uuid('course_id').notNull().references(() => courses.id),
  code:     varchar('code', { length: 50 }).notNull().unique(),  // kode verifikasi publik
  pdfUrl:   text('pdf_url'),
  issuedAt: timestamp('issued_at').defaultNow(),
}, (t) => ({ uniq: unique().on(t.userId, t.courseId) }));

// ============================================================
// TABEL 23: user_settings
// ============================================================
export const userSettings = pgTable('user_settings', {
  userId:             uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  emailNotifications: boolean('email_notifications').default(true),
  language:           varchar('language', { length: 10 }).default('id'),
  timezone:           varchar('timezone', { length: 50 }).default('Asia/Jakarta'),
  updatedAt:          timestamp('updated_at').defaultNow(),
});

// ============================================================
// TABEL 24: refresh_tokens
// ============================================================
export const refreshTokens = pgTable('refresh_tokens', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:     varchar('token', { length: 500 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Ringkasan 24 Tabel

| # | Tabel | Tujuan |
|---|---|---|
| 1 | `users` | Data pengguna + Google bind |
| 2 | `categories` | Kategori kursus |
| 3 | `courses` | Kursus utama |
| 4 | `course_sections` | Bab/Topik dalam kursus |
| 5 | `lessons` | Aktivitas/item dalam bab |
| 6 | `lesson_contents` | Konten aktual (video URL, teks, dll) |
| 7 | `enrollments` | Pendaftaran student |
| 8 | `lesson_progress` | Progress per lesson + resume video |
| 9 | `assignments` | Definisi tugas |
| 10 | `assignment_submissions` | Jawaban tugas student |
| 11 | `quizzes` | Definisi quiz + setting |
| 12 | `quiz_questions` | Soal dalam quiz |
| 13 | `quiz_options` | Pilihan jawaban |
| 14 | `quiz_attempts` | Sesi percobaan quiz |
| 15 | `quiz_answers` | Jawaban per soal per sesi |
| 16 | `grades` | Rekap nilai akhir per kursus |
| 17 | `course_reviews` | Rating & ulasan kursus |
| 18 | `discussions` | Thread diskusi |
| 19 | `discussion_replies` | Balasan diskusi |
| 20 | `announcements` | Pengumuman dari instruktur |
| 21 | `notifications` | Notifikasi sistem per user |
| 22 | `certificates` | Sertifikat kelulusan |
| 23 | `user_settings` | Preferensi user |
| 24 | `refresh_tokens` | JWT refresh token rotation |

---

## 5. Backend API — Routes & Endpoint

### 5.1 Auth (`/api/v1/auth`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/register` | ❌ | Daftar akun baru |
| POST | `/login` | ❌ | Login manual → return accessToken + refreshToken |
| POST | `/refresh` | ❌ | Tukar refresh token dengan access token baru |
| POST | `/logout` | ✅ | Blacklist refresh token |
| GET | `/me` | ✅ | Profil user sendiri |
| PUT | `/me` | ✅ | Update profil (name, bio, phone, avatar) |
| PUT | `/me/password` | ✅ | Ganti password |
| POST | `/me/google/bind` | ✅ | Mulai bind Google → return OAuth URL |
| GET | `/me/google/callback` | ❌ | Callback OAuth Google → simpan google_id |
| DELETE | `/me/google/unbind` | ✅ | Lepas bind Google |
| GET | `/google/login` | ❌ | Login via Google (hanya jika sudah bind) |
| GET | `/google/callback` | ❌ | Callback → cari user by google_id → issue JWT |
| POST | `/forgot-password` | ❌ | Request reset password via email |
| POST | `/reset-password` | ❌ | Submit token reset + password baru |

**Alur Google Bind Detail:**
```
POST /auth/me/google/bind
→ Return { authUrl: "https://accounts.google.com/o/oauth2/auth?..." }
→ Frontend redirect user ke authUrl

GET /auth/me/google/callback?code=...&state={userId}
→ Tukar code dengan Google token
→ Ambil google_id + google_email dari Google API
→ Simpan ke users.google_id dan users.google_email
→ Redirect ke /settings?google_bind=success
```

### 5.2 Users (`/api/v1/users`) — Admin Only

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/` | List semua user (search, filter role, paginated) |
| GET | `/:id` | Detail user |
| POST | `/` | Buat user manual |
| PUT | `/:id` | Edit user |
| PATCH | `/:id/activate` | Aktifkan user |
| PATCH | `/:id/deactivate` | Nonaktifkan user |
| GET | `/:id/enrollments` | Kursus yang diikuti user |

### 5.3 Categories (`/api/v1/categories`)

| Method | Path | Auth | Role | Deskripsi |
|---|---|---|---|---|
| GET | `/` | ❌ | — | List semua kategori |
| POST | `/` | ✅ | admin | Buat kategori |
| PUT | `/:id` | ✅ | admin | Edit kategori |
| DELETE | `/:id` | ✅ | admin | Hapus kategori |

### 5.4 Courses (`/api/v1/courses`)

| Method | Path | Auth | Role | Deskripsi |
|---|---|---|---|---|
| GET | `/` | ❌ | — | List kursus published (search/filter/sort/paginate) |
| GET | `/my` | ✅ | teacher | Kursus milik teacher yang login |
| GET | `/:id` | ❌ | — | Detail kursus publik (info + kurikulum tanpa konten) |
| GET | `/:id/full` | ✅ | enrolled/teacher/admin | Detail + konten lengkap |
| POST | `/` | ✅ | teacher/admin | Buat kursus baru |
| PUT | `/:id` | ✅ | owner/admin | Edit kursus |
| DELETE | `/:id` | ✅ | owner/admin | Hapus kursus |
| PATCH | `/:id/submit` | ✅ | owner | Submit untuk review (draft → pending_review) |
| PATCH | `/:id/publish` | ✅ | admin | Approve & publish |
| PATCH | `/:id/archive` | ✅ | owner/admin | Arsipkan |
| GET | `/:id/students` | ✅ | teacher/admin | List student enrolled |
| GET | `/:id/analytics` | ✅ | teacher/admin | Analytics kursus |
| GET | `/:id/gradebook` | ✅ | teacher/admin | Gradebook semua student |

**Query Params GET `/courses`:**
```
?search=    cari judul/deskripsi
?category=  filter by slug
?level=     beginner|intermediate|advanced|all_levels
?language=  id|en
?sort=      newest|rating|popular
?page=      (default: 1)
?limit=     (default: 12, max: 50)
```

### 5.5 Sections (`/api/v1/courses/:courseId/sections`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/` | ✅ | List sections + lessons (tanpa konten) |
| POST | `/` | ✅ owner/admin | Buat section |
| PUT | `/:sectionId` | ✅ owner/admin | Edit section |
| DELETE | `/:sectionId` | ✅ owner/admin | Hapus section (cascade) |
| PATCH | `/reorder` | ✅ owner/admin | Ubah urutan `{ order: [uuid, uuid, ...] }` |

### 5.6 Lessons (`/api/v1/sections/:sectionId/lessons`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/` | ✅ owner/admin | Buat lesson |
| GET | `/:lessonId` | ✅ enrolled/owner/admin | Get lesson + content |
| PUT | `/:lessonId` | ✅ owner/admin | Edit metadata lesson |
| PUT | `/:lessonId/content` | ✅ owner/admin | Update konten lesson |
| DELETE | `/:lessonId` | ✅ owner/admin | Hapus lesson |
| PATCH | `/reorder` | ✅ owner/admin | Ubah urutan |
| POST | `/:lessonId/complete` | ✅ enrolled | Tandai selesai |
| DELETE | `/:lessonId/complete` | ✅ enrolled | Batalkan completion |
| PATCH | `/:lessonId/video-position` | ✅ enrolled | Simpan posisi video (resume) |

### 5.7 Enrollments (`/api/v1/enrollments`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/courses/:courseId` | ✅ | Enroll ke kursus |
| DELETE | `/courses/:courseId` | ✅ | Keluar dari kursus |
| GET | `/my` | ✅ | Kursus yang diikuti sendiri |
| GET | `/my/:courseId/progress` | ✅ | Progress detail per lesson |
| POST | `/admin/courses/:courseId/users/:userId` | ✅ admin | Enroll manual |
| PATCH | `/admin/:enrollmentId/suspend` | ✅ admin | Suspend enrollment |

### 5.8 Assignments (`/api/v1/assignments`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/lessons/:lessonId` | ✅ owner/admin | Buat assignment |
| PUT | `/:assignmentId` | ✅ owner/admin | Edit assignment |
| GET | `/:assignmentId/submissions` | ✅ teacher/admin | Semua submission |
| POST | `/:assignmentId/submit` | ✅ enrolled | Submit tugas (fileUrl dari upload endpoint) |
| GET | `/:assignmentId/my-submission` | ✅ enrolled | Lihat submission sendiri |
| PATCH | `/submissions/:submissionId/grade` | ✅ teacher/admin | Nilai submission |

### 5.9 Quiz (`/api/v1/quizzes`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/lessons/:lessonId` | ✅ owner/admin | Buat quiz |
| PUT | `/:quizId` | ✅ owner/admin | Edit setting quiz |
| POST | `/:quizId/questions` | ✅ owner/admin | Tambah soal |
| PUT | `/:quizId/questions/:questionId` | ✅ owner/admin | Edit soal |
| DELETE | `/:quizId/questions/:questionId` | ✅ owner/admin | Hapus soal |
| PATCH | `/:quizId/questions/reorder` | ✅ owner/admin | Ubah urutan soal |
| POST | `/:quizId/start` | ✅ enrolled | Mulai attempt → return questions + attemptId |
| POST | `/attempts/:attemptId/submit` | ✅ enrolled | Submit semua jawaban |
| GET | `/attempts/:attemptId/result` | ✅ | Hasil quiz |
| GET | `/:quizId/my-attempts` | ✅ enrolled | Riwayat attempt sendiri |
| GET | `/:quizId/attempts` | ✅ teacher/admin | Semua attempt semua student |

### 5.10 Upload (`/api/v1/upload`)

| Method | Path | Auth | Role | Deskripsi |
|---|---|---|---|---|
| POST | `/video` | ✅ | teacher/admin | Upload video (multipart, max 2GB) |
| POST | `/document` | ✅ | teacher/admin | Upload PDF (max 50MB) |
| POST | `/image` | ✅ | any | Upload gambar (max 5MB) |
| POST | `/assignment` | ✅ | student | Upload file tugas (max 50MB) |
| GET | `/signed-url` | ✅ | enrolled/owner | Presigned URL streaming video |

Response:
```json
{ "url": "https://minio.../uuid.mp4", "fileName": "...", "sizeBytes": 125000000, "mimeType": "video/mp4" }
```

### 5.11 Discussions (`/api/v1/discussions`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/courses/:courseId` | ✅ enrolled/owner/admin | List thread per kursus |
| GET | `/lessons/:lessonId` | ✅ enrolled/owner/admin | Thread per lesson |
| POST | `/courses/:courseId` | ✅ enrolled/teacher/admin | Buat thread |
| GET | `/:discussionId` | ✅ | Detail thread + replies |
| POST | `/:discussionId/replies` | ✅ enrolled/teacher/admin | Balas thread |
| PUT | `/:discussionId` | ✅ author/admin | Edit thread |
| DELETE | `/:discussionId` | ✅ author/teacher/admin | Hapus thread |
| PATCH | `/:discussionId/pin` | ✅ teacher/admin | Pin/unpin thread |

### 5.12 Grades (`/api/v1/grades`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/my` | ✅ student | Nilai semua kursus yang diikuti |
| GET | `/my/courses/:courseId` | ✅ student | Nilai detail kursus tertentu |
| GET | `/courses/:courseId` | ✅ teacher/admin | Gradebook kursus (semua student) |
| GET | `/courses/:courseId/export` | ✅ teacher/admin | Export CSV |

### 5.13 Notifications (`/api/v1/notifications`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/` | ✅ | List notifikasi (max 50 terbaru) |
| GET | `/unread-count` | ✅ | Jumlah belum dibaca |
| PATCH | `/:id/read` | ✅ | Tandai 1 sudah dibaca |
| PATCH | `/read-all` | ✅ | Tandai semua dibaca |
| DELETE | `/:id` | ✅ | Hapus notifikasi |

### 5.14 Certificates (`/api/v1/certificates`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/my` | ✅ | Sertifikat milik user |
| GET | `/:code` | ❌ | Verifikasi publik by kode unik |
| POST | `/courses/:courseId/generate` | ✅ | Manual generate (auto setelah selesai) |

### 5.15 Analytics (`/api/v1/analytics`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/overview` | ✅ admin | Stats global platform |
| GET | `/courses/:courseId` | ✅ teacher/admin | Stats per kursus |
| GET | `/courses/:courseId/completion-funnel` | ✅ teacher/admin | Funnel per section |

### 5.16 Announcements (`/api/v1/announcements`)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/courses/:courseId` | ✅ enrolled/owner/admin | List pengumuman |
| POST | `/courses/:courseId` | ✅ teacher/admin | Buat pengumuman |
| PUT | `/:id` | ✅ author/admin | Edit |
| DELETE | `/:id` | ✅ author/admin | Hapus |

---

## 6. Frontend — Pages & Components

### 6.1 Routing Map

```
/                           → redirect /courses (tamu) atau /dashboard (login)
/login                      → Halaman login
/register                   → Halaman registrasi
/forgot-password            → Request reset password
/reset-password?token=...   → Form password baru
/auth/google/callback       → Handler callback OAuth Google

/courses                    → Katalog kursus (publik)
/courses/:slug              → Detail kursus (publik)
/courses/:slug/learn        → Course player (enrolled only)

/dashboard                  → Redirect ke /student | /teacher | /admin

/student/                   → Dashboard student
/student/my-courses         → Kursus diikuti
/student/grades             → Nilai
/student/certificates       → Sertifikat
/student/profile            → Profil + settings

/teacher/                   → Dashboard teacher
/teacher/courses            → Kursus milik teacher
/teacher/courses/new        → Buat kursus baru
/teacher/courses/:id/edit   → Edit kursus (multi-step)
/teacher/courses/:id/students → Daftar student + progress
/teacher/courses/:id/gradebook → Gradebook kursus

/admin/                     → Dashboard admin
/admin/users                → Manajemen user
/admin/courses              → Semua kursus + approval
/admin/categories           → Manajemen kategori
/admin/analytics            → Analytics global

/verify/:code               → Verifikasi sertifikat (publik, tanpa login)
```

### 6.2 Page Specifications

---

#### `/login` — Login Page

- Logo + nama platform
- Tombol "Login dengan Google" (selalu tampil; jika callback tidak ketemu google_id → tampil error "Akun Google belum dihubungkan, login manual dulu")
- Divider "atau"
- Form: Email + Password
- Link "Lupa password?"
- Link "Belum punya akun? Daftar"
- Error state dengan pesan spesifik
- Jika sudah punya token valid → redirect ke `/dashboard`

---

#### `/register` — Register Page

- Form: Nama Lengkap, Email, Password (min 8 karakter), Konfirmasi Password
- Pilihan Role: Student / Teacher (radio atau segmented control)
- Checkbox persetujuan syarat & ketentuan
- Submit → `POST /auth/register`
- Sukses → redirect `/login` + toast "Registrasi berhasil"

---

#### `/courses` — Course Catalog

**Layout:** Sidebar filter (kiri) + grid kursus (kanan)

- Search bar dengan debounce 300ms
- Sidebar filter: Kategori (checkbox), Level, Bahasa, Harga (gratis/berbayar)
- Sort: Terbaru | Rating Tertinggi | Terpopuler
- Toggle tampilan: Grid 3-kolom / List
- 12 card per halaman + pagination
- Skeleton loader saat fetch

**CourseCard berisi:** Thumbnail (+ badge level), Judul (max 2 baris), Nama instruktur, Rating bintang + jumlah review, Jumlah student, Estimasi durasi, Harga/Gratis, Tombol "Lihat Kursus"

---

#### `/courses/:slug` — Course Detail Page

**Layout:** Konten (70%) + Sticky panel (30%)

**Panel kiri:**
- Breadcrumb: Kategori → Judul
- H1: Judul kursus
- Rating + jumlah ulasan + jumlah student
- Badge: Level, Bahasa, Total Durasi, Jumlah Lesson
- Nama instruktur + avatar + bio singkat
- **"Yang akan kamu pelajari"** — list learning outcomes (2 kolom)
- **"Persyaratan"** — list requirements
- **Kurikulum** — Accordion section:
  - Header: Nama section + jumlah lesson + total durasi
  - Lesson item: ikon tipe + nama + durasi + badge 🔓 free preview
  - Klik free preview lesson → bisa dibuka tanpa enroll
- **Ulasan** — average rating, distribusi bintang 1-5, list review cards
- **Diskusi** — preview 3 thread terbaru

**Panel kanan (sticky):**
- Thumbnail atau preview video
- Harga / "Gratis"
- Tombol "Enroll Sekarang" ATAU "Lanjutkan Belajar" (jika sudah enrolled)
- Info: total siswa, rating, update terakhir

---

#### `/courses/:slug/learn` — Course Player

**Layout:** Main content (75%) + Sidebar navigator (25%)

**Area Utama per tipe:**

- **Video** → Custom HTML5 player:
  - Resume dari posisi terakhir (simpan tiap 10 detik via API)
  - Kecepatan: 0.5x / 0.75x / 1x / 1.25x / 1.5x / 2x
  - Fullscreen, volume, progress bar
  - Auto-mark complete setelah ditonton ≥ 80%

- **Document** → PDF embed/iframe + tombol download

- **Text/Artikel** → Rendered HTML dari TipTap

- **Zoom Link** → Info meeting (tanggal, jam, durasi) + tombol "Buka Zoom" + countdown timer

- **Assignment**:
  - Instruksi tugas
  - Due date dengan status (aktif/terlambat)
  - Drag-drop upload file
  - Status submission (belum/sudah submit)
  - Nilai + feedback teacher (jika sudah dikoreksi)

- **Quiz**:
  - Info: jumlah soal, batas waktu, max attempt, passing score
  - Tombol "Mulai Quiz" (jika attempt masih tersisa)
  - Saat aktif: soal satu per satu + timer countdown
  - Setelah submit: tampil skor + jawaban benar/salah
  - Riwayat attempt sebelumnya (tanggal + skor + status lulus/gagal)

**Tabs di bawah konten:**
- **Overview** — deskripsi lesson
- **Diskusi** — thread khusus lesson ini
- **Catatan** — catatan pribadi (teks bebas, disimpan lokal/backend)

**Sidebar Navigasi (kanan):**
- Nama kursus
- Progress bar keseluruhan (%)
- Section accordion:
  - Nama section + progress (x/n selesai)
  - Lesson items: ikon tipe + nama + ✅/🔒/▶️
- Tombol Previous Lesson + Next Lesson

---

#### `/student/` — Student Dashboard

- "Selamat datang, [Nama]! 👋"
- Stats: Kursus Diikuti | Selesai | Sertifikat | Rata-rata Nilai
- **"Lanjutkan Belajar"** — 3 kursus in-progress + progress bar
- **"Pengumuman Terbaru"** — dari kursus yang diikuti
- **"Aktivitas Terbaru"** — log aktivitas belajar

---

#### `/student/my-courses` — My Courses

- Tabs: Semua | Sedang Belajar | Selesai
- Per kursus: Thumbnail, nama, instruktur, progress bar %, tombol "Lanjutkan"/"Ulang"
- Badge "Selesai" + link sertifikat jika completed

---

#### `/student/grades` — Nilai

- Accordion per kursus
- Expand → tabel: Aktivitas | Tipe | Skor | Status Lulus
- Final Grade + letter grade

---

#### `/teacher/courses/new` & `/teacher/courses/:id/edit` — Course Editor

**Step 1 — Informasi Dasar:**
- Judul, Deskripsi (TipTap), Deskripsi singkat
- Kategori (dropdown), Level, Bahasa, Estimasi jam, Harga
- Upload thumbnail (drag-drop, preview langsung)
- Upload video preview (opsional)

**Step 2 — Kurikulum:**
- Drag-drop reorder sections
- Section: nama + tambah lesson
- Drag-drop reorder lessons dalam section
- Per lesson: judul + tipe + konten sesuai tipe:
  - Video: upload file atau URL eksternal
  - Dokumen: upload PDF
  - Teks: TipTap editor
  - Zoom: URL + tanggal + durasi
  - Assignment: instruksi + due date + tipe file yang dibolehkan
  - Quiz: Quiz Builder inline (lihat di bawah)
- Toggle: Free Preview, estimasi durasi menit

**Quiz Builder (dalam Step 2):**
- List soal (drag-drop reorder)
- Tambah soal → pilih tipe:
  - Multiple choice: teks + 4-6 pilihan (radio pilih yang benar) + penjelasan
  - Multiple answer: teks + pilihan (checkbox, bisa lebih dari 1 benar)
  - True/False: teks + toggle Benar/Salah
  - Short Answer: teks + jawaban benar (string match)
  - Essay: teks + catatan penilaian (dikoreksi manual)
- Setting quiz: batas waktu menit, max attempt, passing score %, shuffle soal, shuffle pilihan

**Step 3 — Pengaturan:**
- Certificate enabled/disabled
- Requirements (tambah/hapus item)
- Learning Outcomes (tambah/hapus item)
- Tags (multi-input)

**Step 4 — Publish:**
- Preview ringkasan informasi
- Pilih: Simpan Draft / Submit untuk Review / Publish (admin)

---

#### `/teacher/courses/:id/students` — Manajemen Student

- Search by nama/email
- Tabel: Avatar | Nama | Email | Enrolled | Progress % | Status
- Klik row → modal: progress per section, nilai quiz, nilai tugas
- Tombol Suspend Enrollment
- Export CSV

---

#### `/teacher/courses/:id/gradebook` — Gradebook

- Tabel spreadsheet: baris=student, kolom=quiz/tugas + Final Grade
- Sort by nama / nilai
- Filter: lulus/gagal
- Klik cell assignment → modal grading langsung
- Export CSV

---

#### `/admin/` — Admin Dashboard

- Stats: Total Users, Total Kursus (breakdown status), Enrollment bulan ini, Completion rate
- Line chart: Enrollment per bulan (6 bulan terakhir)
- Bar chart: Top 5 kursus terpopuler

---

#### `/admin/users` — User Management

- Search + filter role + filter status
- Tabel + aksi per row: Edit | Activate/Deactivate
- Bulk action: Activate / Deactivate
- "+ Tambah User" → modal form
- Export CSV

---

#### `/admin/courses` — Course Management + Approval

- Tabs: Semua | Pending Review | Published | Draft | Archived
- Tabel: Thumbnail | Judul | Instruktur | Kategori | Status | Enrolled | Rating
- Aksi: Publish (untuk pending) | Archive | Delete

---

#### `/verify/:code` — Sertifikat Verifikasi Publik

- Tanpa login
- Tampilkan: Nama pemegang, Nama kursus, Instruktur, Tanggal diterbitkan
- Tombol Download PDF, tombol Share (copy link)
- Jika code invalid → tampil error

---

### 6.3 Component Library

#### `src/components/ui/`

| Komponen | Deskripsi |
|---|---|
| `Button` | Primary/Secondary/Ghost/Danger, size sm/md/lg, loading state |
| `Input` | Text input + label + error + helper text |
| `Textarea` | Multi-line input |
| `Select` | Dropdown + search (Combobox) |
| `Checkbox`, `Radio` | Form controls |
| `Badge` | Status label |
| `Avatar` | Gambar profil + fallback inisial |
| `Modal` | Dialog overlay dengan focus trap (WCAG) |
| `Drawer` | Side panel untuk mobile |
| `Toast` | Notifikasi sementara success/error/info |
| `Tooltip` | Hover explanation |
| `Card` | Container dengan shadow |
| `Table` | Tabel dengan sortable header |
| `Pagination` | Navigasi halaman |
| `Skeleton` | Loading placeholder |
| `Progress` | Progress bar horizontal |
| `ProgressRing` | Progress bar circular |
| `Tabs` | Tab navigation |
| `Accordion` | Collapsible sections |
| `Breadcrumb` | Navigasi hierarki |
| `EmptyState` | Ilustrasi + pesan saat data kosong |
| `ConfirmDialog` | Modal konfirmasi aksi berbahaya |
| `RatingStars` | Display + input bintang |

#### `src/components/layout/`

| Komponen | Deskripsi |
|---|---|
| `AppShell` | Layout: sidebar + topnav + main content |
| `Sidebar` | Navigasi lateral per role, collapsible |
| `TopNav` | Search global, notifikasi (badge), avatar menu |
| `PageHeader` | Judul + breadcrumb + action buttons |
| `Footer` | Footer sederhana |

#### `src/components/course/`

| Komponen | Deskripsi |
|---|---|
| `CourseCard` | Card untuk catalog (grid/list) |
| `CurriculumAccordion` | Kurikulum di detail kursus |
| `LessonNavigator` | Sidebar di course player |
| `VideoPlayer` | HTML5 player + resume + speed |
| `QuizWidget` | Interface quiz (soal + timer + submit) |
| `AssignmentWidget` | Upload tugas + lihat hasil |
| `ZoomWidget` | Info Zoom + countdown |
| `ReviewCard` | Kartu ulasan student |
| `CourseProgress` | Progress bar di my-courses |

#### `src/components/editor/`

| Komponen | Deskripsi |
|---|---|
| `RichTextEditor` | TipTap (bold, italic, heading, list, image, link) |
| `VideoUploader` | Drag-drop + progress bar upload video |
| `FileUploader` | Upload generik (dokumen/tugas) |
| `ImageUploader` | Upload + preview thumbnail |
| `QuizBuilder` | Editor quiz lengkap (soal + pilihan + setting) |
| `SortableList` | Drag-drop reorder (dnd-kit) |

### 6.4 State Management (Zustand)

```typescript
authStore.ts        // user, token, setAuth, logout
courseStore.ts      // course detail cache, enrollment status
playerStore.ts      // current lesson, video position, progress
notificationStore.ts // list notif, unread count
uiStore.ts          // sidebar open/close, theme
```

### 6.5 Server State: TanStack Query

Semua fetch data API menggunakan `@tanstack/react-query`:
- Auto-caching, refetch, invalidation
- Optimistic updates untuk mark lesson complete, read notifikasi
- Infinite query untuk catalog infinite scroll

---

## 7. Infrastruktur & DevOps

### 7.1 Docker Compose (Updated)

```yaml
services:
  db:
    image: postgres:15-alpine
    environment: { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB }
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck: { test: pg_isready, interval: 10s }

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes: [redis_data:/data]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment: { MINIO_ROOT_USER, MINIO_ROOT_PASSWORD }
    volumes: [minio_data:/data]
    ports: ["9000:9000", "9001:9001"]

  backend:
    build: ./backend
    environment:
      DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET,
      MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET,
      GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL,
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, APP_URL
    depends_on: { db: { condition: service_healthy }, redis: ... }

  frontend:
    build: ./frontend
    depends_on: [backend]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: [./nginx/nginx.conf:/etc/nginx/nginx.conf]

volumes: { postgres_data, redis_data, minio_data }
```

### 7.2 Environment Variables (`.env.example`)

```env
DB_PASSWORD=strong_password_here
JWT_SECRET=random_256bit_secret
JWT_REFRESH_SECRET=another_random_256bit_secret
REDIS_PASSWORD=redis_password

MINIO_ACCESS_KEY=minio_access_key
MINIO_SECRET_KEY=minio_secret_min_8_chars
MINIO_BUCKET=elearning

GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASS=xxx
FROM_EMAIL=noreply@elearning.example.com

APP_URL=http://localhost:8080
```

### 7.3 Nginx (Updated)

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header Referrer-Policy "strict-origin-when-cross-origin";

# Gzip compression
gzip on;

# Frontend SPA
location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
    # Cache static assets 1 tahun
    location ~* \.(js|css|png|jpg|woff2)$ { expires 1y; add_header Cache-Control "immutable"; }
}

# Backend API dengan rate limit
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://backend:3000/api/;
    client_max_body_size 2G;    # untuk upload video
    proxy_read_timeout 120s;
}
```

### 7.4 Backend Services

#### `services/storage.ts` — MinIO

```
uploadFile(bucket, key, buffer, mimeType) → url
getSignedUrl(bucket, key, expirySeconds) → presigned url
deleteFile(bucket, key) → void
fileExists(bucket, key) → boolean
```

#### `services/email.ts` — Nodemailer

Template email yang dikirim:
- `welcome` — setelah register
- `enrollment_confirmed` — setelah enroll
- `assignment_graded` — nilai tugas masuk
- `quiz_passed` / `quiz_failed` — hasil quiz
- `certificate_issued` — sertifikat tersedia + PDF attachment
- `zoom_reminder` — H-1 jam sebelum Zoom meeting
- `password_reset` — link reset (expire 1 jam)
- `new_announcement` — pengumuman baru

#### `services/certificate.ts` — PDF Generation

- Library: `pdf-lib` untuk generate PDF
- Template: desain sertifikat dengan logo, nama, kursus, instruktur, tanggal
- QR Code (`qrcode` library) → URL `/verify/:code`
- Upload PDF ke MinIO → simpan URL ke tabel `certificates`

#### `services/progress.ts` — Progress Calculator

Dipanggil tiap kali `lesson_progress` diupdate:
1. Hitung: `completedLessons / totalLessons * 100`
2. Update: `enrollments.progress`
3. Jika progress = 100%:
   - Set `enrollments.completed_at` + `enrollments.status = 'completed'`
   - Jika `course.certificate_enabled = true` → auto-generate sertifikat
   - Kirim notifikasi internal + email "Selamat, kursus selesai!"
4. Update grade: kalkulasi ulang `grades.final_grade`

---

## 8. Keamanan

### 8.1 JWT Strategy

- **Access Token**: expire **15 menit**, stored di **Zustand memory** (tidak di localStorage)
- **Refresh Token**: expire **7 hari**, stored di **localStorage**
- **Token Rotation**: tiap `/auth/refresh`, refresh token lama di-invalidate di DB, issue baru
- **Logout**: hapus refresh token dari DB + clear localStorage

### 8.2 Rate Limiting (per IP)

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 5x / 15 menit |
| `POST /auth/register` | 3x / jam |
| `POST /auth/forgot-password` | 3x / jam |
| `POST /upload/*` | 10x / menit |
| API umum | 100x / menit |

Implementasi: middleware Hono + ioredis (counter per IP)

### 8.3 Input Validation & Sanitization

- Body request: Zod schema (sudah ada dari `@hono/zod-openapi`)
- Rich text HTML dari TipTap: sanitize dengan `dompurify` (server-side via `isomorphic-dompurify`) sebelum simpan ke DB
- File upload: validasi MIME type via `file-type` (magic bytes, bukan extension)
- File rename ke UUID saat simpan ke MinIO (cegah path traversal)

### 8.4 Ownership Authorization

Helper function `assertOwnerOrAdmin(resource, payload)`:
- Cek `resource.instructorId === payload.id` ATAU `payload.role === 'admin'`
- Dipakai di semua endpoint yang modify data kursus/section/lesson

---

## 9. Rencana Implementasi Bertahap (8 Minggu)

### FASE 1 — Core Foundation (Minggu 1-2)

**Target:** Platform bisa dipakai end-to-end (enroll → akses kursus → tandai selesai)

**Minggu 1 — Backend:**
- [ ] Schema DB lengkap (24 tabel) → migration → seed data dummy
- [ ] `routes/course.ts` — CRUD + filter/search/pagination
- [ ] `routes/section.ts` — CRUD + reorder
- [ ] `routes/lesson.ts` — CRUD + progress tracking
- [ ] `routes/enrollment.ts` — enroll/unenroll + my-courses
- [ ] `routes/category.ts` — CRUD
- [ ] `services/progress.ts` — kalkulasi progress
- [ ] Update `backend/src/index.ts` — register semua routes baru

**Minggu 2 — Frontend:**
- [ ] Routing lengkap di `App.tsx`
- [ ] Design system: `tailwind.config.js` (warna, font, spacing)
- [ ] `components/ui/` — semua 21 base components
- [ ] `components/layout/` — AppShell, Sidebar, TopNav
- [ ] Landing page
- [ ] Login + Register page (redesign)
- [ ] Course Catalog (`/courses`)
- [ ] Course Detail (`/courses/:slug`)
- [ ] Course Player — versi dasar (text + dokumen)
- [ ] Student Dashboard (dasar)

---

### FASE 2 — Media & Assessment (Minggu 3-4)

**Target:** Video + Quiz + Assignment + Email

**Minggu 3 — Backend:**
- [ ] Docker Compose: tambah MinIO + Redis
- [ ] `services/storage.ts` — MinIO client
- [ ] `routes/upload.ts` — endpoint upload semua tipe
- [ ] `routes/assignment.ts` — CRUD + submission + grading
- [ ] `routes/quiz.ts` — CRUD quiz/soal/pilihan + attempt + submit
- [ ] `services/email.ts` — Nodemailer + semua template

**Minggu 3 — Frontend:**
- [ ] Course Player: VideoPlayer component (resume, speed)
- [ ] Course Player: Document viewer
- [ ] Course Player: Zoom widget
- [ ] Course Player: Assignment widget

**Minggu 4 — Frontend:**
- [ ] Course Player: Quiz widget (soal + timer + hasil)
- [ ] Teacher: Course Editor Step 1-2 (info + kurikulum basic)
- [ ] Teacher: Course Editor Step 2 — VideoUploader + FileUploader
- [ ] Teacher: Course Editor — QuizBuilder
- [ ] Teacher: Course Editor Step 3-4 (pengaturan + publish)
- [ ] Teacher Dashboard

---

### FASE 3 — Student Experience & Admin (Minggu 5-6)

**Target:** Experience student lengkap + admin panel fungsional

**Minggu 5:**
- [ ] `routes/discussion.ts` — thread + reply
- [ ] `routes/announcement.ts`
- [ ] `routes/notification.ts`
- [ ] Discussion component di Course Player
- [ ] Announcement panel
- [ ] Notification panel (TopNav badge + dropdown)
- [ ] Student: My Courses + progress
- [ ] Student: Grades page
- [ ] Teacher: Student Management + Gradebook

**Minggu 6:**
- [ ] `services/certificate.ts` — PDF generation
- [ ] `routes/certificate.ts` — generate + verify
- [ ] Student: Certificates page
- [ ] `/verify/:code` — public verification page
- [ ] `routes/user.ts` — Admin user management
- [ ] `routes/analytics.ts`
- [ ] Admin: Dashboard + User Management
- [ ] Admin: Course Management + Approval
- [ ] Admin: Category Management

---

### FASE 4 — Auth Lanjut, Analytics & Polish (Minggu 7-8)

**Target:** Google bind, analytics, security, performance

**Minggu 7:**
- [ ] Refresh Token system (rotation) di `routes/auth.ts`
- [ ] Google OAuth bind — `POST /auth/me/google/bind` + callback
- [ ] Google Login — `GET /auth/google/login` + callback
- [ ] Forgot Password + Reset Password flow + email
- [ ] Settings page (profil, password, bind Google, preferensi notif)
- [ ] Admin: Analytics dashboard (Recharts)
- [ ] Teacher: Course analytics

**Minggu 8:**
- [ ] Rate limiting middleware dengan Redis
- [ ] Input sanitization (dompurify server-side untuk rich text)
- [ ] Security headers Nginx (finalisasi)
- [ ] TanStack Query: ganti semua manual `useState + useEffect + axios` fetch
- [ ] Code splitting: lazy load halaman-halaman besar
- [ ] Lighthouse audit → fix issues (target: Performance ≥ 80, A11y ≥ 90)
- [ ] WCAG review: ARIA labels, keyboard nav, color contrast
- [ ] End-to-end testing 3 critical flows (manual)
- [ ] Docker healthchecks + resource limits
- [ ] `.env.example` + `README.md` setup guide

---

## 10. Struktur Direktori Target

```
elearning-new/
├── IMPLEMENTATION_PLAN.md       ← dokumen ini
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
│   ├── package.json             MODIFY
│   └── src/
│       ├── index.ts             MODIFY (register semua routes)
│       ├── db/
│       │   ├── index.ts         tidak berubah
│       │   └── schema.ts        FULL REWRITE (24 tabel)
│       ├── middleware/
│       │   ├── jwt.ts           tidak berubah
│       │   ├── rateLimit.ts     NEW
│       │   └── upload.ts        NEW (file upload handler)
│       ├── routes/
│       │   ├── auth.ts          MODIFY (+ google oauth, refresh token)
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
│           ├── storage.ts       NEW (MinIO)
│           ├── email.ts         NEW (Nodemailer)
│           ├── certificate.ts   NEW (pdf-lib)
│           ├── progress.ts      NEW (progress calculator)
│           └── notification.ts  NEW (create & dispatch notifs)
│
└── frontend/
    ├── index.html               MODIFY (lang=id, meta SEO)
    ├── vite.config.ts           MODIFY (path alias @/)
    ├── tailwind.config.js       MODIFY (design tokens)
    ├── package.json             MODIFY (tambah deps)
    └── src/
        ├── main.tsx
        ├── App.tsx              FULL REWRITE (routing lengkap)
        ├── index.css            MODIFY (custom CSS properties)
        ├── components/
        │   ├── ui/              NEW (21 base components)
        │   ├── layout/          NEW (AppShell, Sidebar, TopNav, dll)
        │   ├── course/          NEW (CourseCard, VideoPlayer, dll)
        │   └── editor/          NEW (RichTextEditor, QuizBuilder, dll)
        ├── pages/
        │   ├── Landing.tsx      NEW
        │   ├── Login.tsx        MODIFY (redesign + Google button)
        │   ├── Register.tsx     NEW
        │   ├── ForgotPassword.tsx NEW
        │   ├── ResetPassword.tsx  NEW
        │   ├── CourseCatalog.tsx  NEW
        │   ├── CourseDetail.tsx   NEW
        │   ├── CoursePlayer.tsx   NEW
        │   ├── VerifyCertificate.tsx NEW
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

---

## 11. Dependency Tambahan

### Backend

```json
{
  "dependencies": {
    "ioredis": "^5.x",          // Redis client
    "minio": "^8.x",            // MinIO S3 client
    "nodemailer": "^7.x",       // Email
    "googleapis": "^150.x",     // Google OAuth
    "pdf-lib": "^1.x",          // PDF sertifikat
    "qrcode": "^1.x",           // QR code
    "file-type": "^19.x",       // Validasi MIME type upload
    "slugify": "^1.x",          // Generate URL slug
    "nanoid": "^5.x",           // Kode unik sertifikat
    "isomorphic-dompurify": "^2.x"  // Sanitize HTML server-side
  },
  "devDependencies": {
    "@types/nodemailer": "^6.x",
    "@types/qrcode": "^1.x",
    "vitest": "^2.x"            // Testing
  }
}
```

### Frontend

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x",   // Server state
    "@tiptap/react": "^2.x",           // Rich text editor
    "@tiptap/starter-kit": "^2.x",
    "@tiptap/extension-image": "^2.x",
    "@tiptap/extension-link": "^2.x",
    "@dnd-kit/core": "^6.x",           // Drag-drop
    "@dnd-kit/sortable": "^8.x",
    "recharts": "^2.x",                // Charts
    "react-player": "^2.x",            // Video player
    "dayjs": "^1.x",                   // Tanggal/waktu
    "clsx": "^2.x",                    // Class utility
    "tailwind-merge": "^2.x"           // Merge TW classes
  }
}
```

---

## 12. Verification Plan

### Critical Flow 1: Student Belajar Hingga Dapat Sertifikat

```
Register → Login → Browse catalog → Lihat detail kursus →
Enroll → Buka course player → Tonton video (auto-complete setelah 80%) →
Baca artikel (manual complete) → Kerjakan quiz (pass) →
Submit tugas → Tugas dinilai teacher → Semua lesson selesai →
Auto-generate sertifikat → Download PDF → Verifikasi URL publik
```

### Critical Flow 2: Teacher Membuat Kursus Hingga Publish

```
Login (teacher) → Teacher Dashboard → "Buat Kursus Baru" →
Isi informasi (Step 1) → Buat 2 sections + 5 lessons berbagai tipe (Step 2) →
Upload video → Buat quiz 5 soal → Buat assignment → Submit untuk review →
Admin login → Course Management → Tab "Pending Review" →
Klik "Publish" → Kursus muncul di katalog publik
```

### Critical Flow 3: Google Account Bind

```
Login manual → Pergi ke /student/profile → Klik "Hubungkan dengan Google" →
Redirect ke Google OAuth → Login dengan akun Google →
Callback → bind sukses → Kembali ke settings →
Logout → Halaman login → Klik "Login dengan Google" →
Pilih akun yang sama → Login berhasil → Redirect ke dashboard
```

### Checklist per Fase

**Fase 1:** ✅ Selesai (2026-07-09)
- [x] CRUD kursus/section/lesson berfungsi (API; UI manajemen pengajar di Fase 2)
- [x] Enrollment berfungsi (enroll/unenroll)
- [x] Progress tracking update otomatis
- [x] Protected routes (redirect jika tidak login)
- [x] Role-based routing (admin ke /admin, teacher ke /teacher, dll)

**Fase 2:**
- [ ] Upload video → muncul dan bisa diputar di course player
- [ ] Resume video dari posisi terakhir
- [ ] Quiz: ambil → submit → lihat hasil
- [ ] Assignment: upload → teacher nilai → student lihat nilai
- [ ] Email terkirim saat enrollment

**Fase 3:**
- [ ] Diskusi bisa dibuat dan dibalas
- [ ] Pengumuman masuk ke notifikasi student yang enrolled
- [ ] Sertifikat auto-generate saat kursus 100% selesai
- [ ] Verifikasi sertifikat publik berfungsi
- [ ] Admin bisa approve kursus pending

**Fase 4:**
- [ ] Bind Google → Login via Google berfungsi
- [ ] Forgot password → email reset → password baru
- [ ] Refresh token: access token expire → auto-refresh
- [ ] Rate limiting: brute force login tercegah
- [ ] Lighthouse Performance ≥ 80
- [ ] Lighthouse Accessibility ≥ 90

---

*Dokumen ini adalah panduan implementasi lengkap dan detail. Semua keputusan teknis yang belum dicakup harus mengikuti konvensi dan pola yang sudah ditetapkan di sini.*
