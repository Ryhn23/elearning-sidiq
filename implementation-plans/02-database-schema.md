# 02 — Database Schema Lengkap (24 Tabel)

> **Kembali ke:** [Index](./00-INDEX.md)  
> **File target:** `backend/src/db/schema.ts` (full rewrite)

---

## Ringkasan 24 Tabel

| # | Tabel | Fase | Tujuan |
|---|---|:---:|---|
| 1 | `users` | 1 | Data pengguna + Google bind |
| 2 | `categories` | 1 | Kategori kursus |
| 3 | `courses` | 1 | Kursus utama |
| 4 | `course_sections` | 1 | Bab/Topik dalam kursus |
| 5 | `lessons` | 1 | Aktivitas/item dalam bab |
| 6 | `lesson_contents` | 1 | Konten aktual (video URL, teks, dll) |
| 7 | `enrollments` | 1 | Pendaftaran student ke kursus |
| 8 | `lesson_progress` | 1 | Progress per lesson + resume video |
| 9 | `assignments` | 2 | Definisi tugas |
| 10 | `assignment_submissions` | 2 | Jawaban tugas student |
| 11 | `quizzes` | 2 | Definisi quiz + setting |
| 12 | `quiz_questions` | 2 | Soal dalam quiz |
| 13 | `quiz_options` | 2 | Pilihan jawaban |
| 14 | `quiz_attempts` | 2 | Sesi percobaan quiz |
| 15 | `quiz_answers` | 2 | Jawaban per soal per sesi |
| 16 | `grades` | 2 | Rekap nilai akhir per kursus |
| 17 | `course_reviews` | 3 | Rating & ulasan kursus |
| 18 | `discussions` | 3 | Thread diskusi |
| 19 | `discussion_replies` | 3 | Balasan diskusi |
| 20 | `announcements` | 3 | Pengumuman dari instruktur |
| 21 | `notifications` | 3 | Notifikasi sistem per user |
| 22 | `certificates` | 3 | Sertifikat kelulusan |
| 23 | `user_settings` | 4 | Preferensi user |
| 24 | `refresh_tokens` | 4 | JWT refresh token rotation |

---

## Enums

```typescript
import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  integer, real, bigint, timestamp, unique
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', [
  'admin', 'teacher', 'student'
]);

export const courseLevelEnum = pgEnum('course_level', [
  'beginner', 'intermediate', 'advanced', 'all_levels'
]);

export const courseStatusEnum = pgEnum('course_status', [
  'draft', 'pending_review', 'published', 'archived'
]);

export const lessonTypeEnum = pgEnum('lesson_type', [
  'video', 'document', 'text', 'zoom_link', 'assignment', 'quiz'
]);

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'submitted', 'graded', 'revision_requested', 'late'
]);

export const questionTypeEnum = pgEnum('question_type', [
  'multiple_choice',  // 1 jawaban benar
  'multiple_answer',  // bisa multi-jawaban benar
  'true_false',
  'short_answer',     // exact match
  'essay'             // manual grading
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'enrollment', 'new_content', 'assignment_graded',
  'quiz_result', 'announcement', 'discussion_reply', 'zoom_reminder'
]);

export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'active', 'completed', 'suspended'
]);
```

---

## Tabel 1-8: Core (Fase 1)

### Tabel 1: `users`

```typescript
export const users = pgTable('users', {
  id:           uuid('id').defaultRandom().primaryKey(),
  name:         varchar('name', { length: 255 }).notNull(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),  // nullable (future pure Google)
  role:         roleEnum('role').default('student').notNull(),

  // Google OAuth bind (Fase 4)
  googleId:     varchar('google_id', { length: 255 }).unique(),
  googleEmail:  varchar('google_email', { length: 255 }),

  // Profil tambahan
  avatarUrl:    text('avatar_url'),
  bio:          text('bio'),
  phone:        varchar('phone', { length: 20 }),

  // Status akun
  isActive:     boolean('is_active').default(true).notNull(),
  lastLoginAt:  timestamp('last_login_at'),
  createdAt:    timestamp('created_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow(),
});
```

**Perubahan dari versi saat ini:** Tambah `googleId`, `googleEmail`, `avatarUrl`, `bio`, `phone`, `isActive`, `lastLoginAt`, `updatedAt`.

---

### Tabel 2: `categories`

```typescript
export const categories = pgTable('categories', {
  id:          uuid('id').defaultRandom().primaryKey(),
  name:        varchar('name', { length: 100 }).notNull(),
  slug:        varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  iconUrl:     text('icon_url'),
  sortOrder:   integer('sort_order').default(0),
  createdAt:   timestamp('created_at').defaultNow(),
});
```

---

### Tabel 3: `courses`

```typescript
export const courses = pgTable('courses', {
  id:                 uuid('id').defaultRandom().primaryKey(),
  slug:               varchar('slug', { length: 300 }).notNull().unique(),
  title:              varchar('title', { length: 255 }).notNull(),
  description:        text('description'),
  shortDescription:   varchar('short_description', { length: 500 }),
  thumbnailUrl:       text('thumbnail_url'),
  previewVideoUrl:    text('preview_video_url'),

  // Relasi
  instructorId:       uuid('instructor_id').notNull().references(() => users.id),
  categoryId:         uuid('category_id').references(() => categories.id),

  // Meta
  level:              courseLevelEnum('level').default('all_levels'),
  status:             courseStatusEnum('status').default('draft').notNull(),
  language:           varchar('language', { length: 10 }).default('id'),
  estimatedHours:     integer('estimated_hours'),
  price:              integer('price').default(0),  // Rupiah, 0 = gratis

  // Konten meta
  learningOutcomes:   text('learning_outcomes').array(),
  requirements:       text('requirements').array(),
  tags:               text('tags').array(),
  certificateEnabled: boolean('certificate_enabled').default(false),

  // Denormalized stats (update via trigger/service)
  totalEnrolled:      integer('total_enrolled').default(0),
  averageRating:      real('average_rating').default(0),
  totalReviews:       integer('total_reviews').default(0),

  publishedAt:        timestamp('published_at'),
  createdAt:          timestamp('created_at').defaultNow(),
  updatedAt:          timestamp('updated_at').defaultNow(),
});
```

**Perubahan dari versi saat ini:** Hampir semua field baru. `id` dan `title` dipertahankan.

---

### Tabel 4: `course_sections`

```typescript
export const courseSections = pgTable('course_sections', {
  id:          uuid('id').defaultRandom().primaryKey(),
  courseId:    uuid('course_id').notNull()
                 .references(() => courses.id, { onDelete: 'cascade' }),
  title:       varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  sortOrder:   integer('sort_order').default(0).notNull(),
  isVisible:   boolean('is_visible').default(true),
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
});
```

---

### Tabel 5: `lessons`

```typescript
export const lessons = pgTable('lessons', {
  id:              uuid('id').defaultRandom().primaryKey(),
  sectionId:       uuid('section_id').notNull()
                     .references(() => courseSections.id, { onDelete: 'cascade' }),
  title:           varchar('title', { length: 255 }).notNull(),
  type:            lessonTypeEnum('type').notNull(),
  sortOrder:       integer('sort_order').default(0).notNull(),
  isVisible:       boolean('is_visible').default(true),
  isFreePreview:   boolean('is_free_preview').default(false),  // bisa dilihat tanpa enroll
  durationMinutes: integer('duration_minutes'),                // estimasi durasi
  createdAt:       timestamp('created_at').defaultNow(),
  updatedAt:       timestamp('updated_at').defaultNow(),
});
```

---

### Tabel 6: `lesson_contents`

> Dipisah dari `lessons` agar query list lesson tetap ringan (tidak fetch blob besar)

```typescript
export const lessonContents = pgTable('lesson_contents', {
  id:       uuid('id').defaultRandom().primaryKey(),
  lessonId: uuid('lesson_id').notNull()
              .references(() => lessons.id, { onDelete: 'cascade' })
              .unique(),  // relasi 1-to-1

  // === type: 'video' ===
  videoUrl:         text('video_url'),           // URL dari MinIO
  videoDurationSec: integer('video_duration_sec'),
  videoSizeBytes:   bigint('video_size_bytes', { mode: 'number' }),

  // === type: 'document' ===
  documentUrl:      text('document_url'),        // URL PDF dari MinIO
  documentName:     varchar('document_name', { length: 255 }),
  documentSizeBytes: bigint('document_size_bytes', { mode: 'number' }),

  // === type: 'text' ===
  textContent:      text('text_content'),        // HTML dari TipTap

  // === type: 'zoom_link' ===
  zoomUrl:          text('zoom_url'),
  zoomMeetingId:    varchar('zoom_meeting_id', { length: 100 }),
  zoomStartAt:      timestamp('zoom_start_at'),
  zoomDurationMin:  integer('zoom_duration_min'),

  // === type: 'assignment' ===
  // Instruksi tugas di sini; detail assignment di tabel assignments
  assignmentInstructions: text('assignment_instructions'),

  // === type: 'quiz' ===
  // Tidak ada data di sini; quiz detail di tabel quizzes (via lessonId FK)

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

---

### Tabel 7: `enrollments`

```typescript
export const enrollments = pgTable('enrollments', {
  id:          uuid('id').defaultRandom().primaryKey(),
  userId:      uuid('user_id').notNull().references(() => users.id),
  courseId:    uuid('course_id').notNull().references(() => courses.id),
  status:      enrollmentStatusEnum('status').default('active').notNull(),
  progress:    real('progress').default(0),  // 0.0 - 100.0 persen
  completedAt: timestamp('completed_at'),
  enrolledAt:  timestamp('enrolled_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.userId, t.courseId),  // 1 enrollment per user per course
}));
```

---

### Tabel 8: `lesson_progress`

```typescript
export const lessonProgress = pgTable('lesson_progress', {
  id:            uuid('id').defaultRandom().primaryKey(),
  userId:        uuid('user_id').notNull().references(() => users.id),
  lessonId:      uuid('lesson_id').notNull().references(() => lessons.id),
  courseId:      uuid('course_id').notNull().references(() => courses.id),
  isCompleted:   boolean('is_completed').default(false).notNull(),
  videoPosition: integer('video_position').default(0),  // detik, untuk resume video
  completedAt:   timestamp('completed_at'),
  lastAccessAt:  timestamp('last_access_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.userId, t.lessonId),
}));
```

---

## Tabel 9-16: Assessment (Fase 2)

### Tabel 9: `assignments`

```typescript
export const assignments = pgTable('assignments', {
  id:               uuid('id').defaultRandom().primaryKey(),
  lessonId:         uuid('lesson_id').notNull()
                      .references(() => lessons.id, { onDelete: 'cascade' })
                      .unique(),  // 1 assignment per lesson
  dueDate:          timestamp('due_date'),
  maxScore:         integer('max_score').default(100),
  allowedFileTypes: text('allowed_file_types').array(),  // ['pdf','docx','zip']
  maxFileSizeMb:    integer('max_file_size_mb').default(10),
  createdAt:        timestamp('created_at').defaultNow(),
  updatedAt:        timestamp('updated_at').defaultNow(),
});
```

---

### Tabel 10: `assignment_submissions`

```typescript
export const assignmentSubmissions = pgTable('assignment_submissions', {
  id:            uuid('id').defaultRandom().primaryKey(),
  assignmentId:  uuid('assignment_id').notNull().references(() => assignments.id),
  userId:        uuid('user_id').notNull().references(() => users.id),
  fileUrl:       text('file_url').notNull(),          // URL dari MinIO
  fileName:      varchar('file_name', { length: 255 }),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  notes:         text('notes'),                        // catatan student
  status:        assignmentStatusEnum('status').default('submitted'),
  score:         real('score'),                        // nilai dari teacher
  feedback:      text('feedback'),                     // komentar teacher
  gradedById:    uuid('graded_by_id').references(() => users.id),
  gradedAt:      timestamp('graded_at'),
  submittedAt:   timestamp('submitted_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.assignmentId, t.userId),         // 1 submission per student
}));
```

---

### Tabel 11: `quizzes`

```typescript
export const quizzes = pgTable('quizzes', {
  id:                    uuid('id').defaultRandom().primaryKey(),
  lessonId:              uuid('lesson_id').notNull()
                           .references(() => lessons.id, { onDelete: 'cascade' })
                           .unique(),
  timeLimitMin:          integer('time_limit_min'),       // null = tidak ada limit
  maxAttempts:           integer('max_attempts').default(3),
  passingScore:          integer('passing_score').default(70),  // persen minimum lulus
  shuffleQuestions:      boolean('shuffle_questions').default(false),
  shuffleOptions:        boolean('shuffle_options').default(false),
  showResultImmediately: boolean('show_result_immediately').default(true),
  createdAt:             timestamp('created_at').defaultNow(),
  updatedAt:             timestamp('updated_at').defaultNow(),
});
```

---

### Tabel 12: `quiz_questions`

```typescript
export const quizQuestions = pgTable('quiz_questions', {
  id:           uuid('id').defaultRandom().primaryKey(),
  quizId:       uuid('quiz_id').notNull()
                  .references(() => quizzes.id, { onDelete: 'cascade' }),
  type:         questionTypeEnum('type').notNull(),
  questionText: text('question_text').notNull(),   // HTML diperbolehkan
  imageUrl:     text('image_url'),                 // gambar soal (opsional)
  points:       real('points').default(1),
  sortOrder:    integer('sort_order').default(0),
  explanation:  text('explanation'),               // penjelasan jawaban benar
  createdAt:    timestamp('created_at').defaultNow(),
});
```

---

### Tabel 13: `quiz_options`

```typescript
export const quizOptions = pgTable('quiz_options', {
  id:         uuid('id').defaultRandom().primaryKey(),
  questionId: uuid('question_id').notNull()
                .references(() => quizQuestions.id, { onDelete: 'cascade' }),
  optionText: text('option_text').notNull(),
  isCorrect:  boolean('is_correct').default(false).notNull(),
  sortOrder:  integer('sort_order').default(0),
});
```

---

### Tabel 14: `quiz_attempts`

```typescript
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
```

---

### Tabel 15: `quiz_answers`

```typescript
export const quizAnswers = pgTable('quiz_answers', {
  id:                uuid('id').defaultRandom().primaryKey(),
  attemptId:         uuid('attempt_id').notNull()
                       .references(() => quizAttempts.id, { onDelete: 'cascade' }),
  questionId:        uuid('question_id').notNull()
                       .references(() => quizQuestions.id),
  selectedOptionIds: uuid('selected_option_ids').array(),  // untuk MC/MA/TF
  textAnswer:        text('text_answer'),                   // untuk short_answer/essay
  isCorrect:         boolean('is_correct'),                 // null jika essay
  pointsEarned:      real('points_earned'),
});
```

---

### Tabel 16: `grades`

> Rekap nilai denormalized untuk performa query gradebook

```typescript
export const grades = pgTable('grades', {
  id:                  uuid('id').defaultRandom().primaryKey(),
  userId:              uuid('user_id').notNull().references(() => users.id),
  courseId:            uuid('course_id').notNull().references(() => courses.id),
  quizAverage:         real('quiz_average'),
  assignmentAverage:   real('assignment_average'),
  finalGrade:          real('final_grade'),
  letterGrade:         varchar('letter_grade', { length: 5 }),  // A, B, C, D, E
  updatedAt:           timestamp('updated_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.userId, t.courseId),
}));
```

**Letter Grade Logic:**
```
≥ 90  → A
≥ 80  → B
≥ 70  → C
≥ 60  → D
< 60  → E
```

---

## Tabel 17-22: Social & Notifications (Fase 3)

### Tabel 17: `course_reviews`

```typescript
export const courseReviews = pgTable('course_reviews', {
  id:        uuid('id').defaultRandom().primaryKey(),
  courseId:  uuid('course_id').notNull()
               .references(() => courses.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id),
  rating:    integer('rating').notNull(),  // 1-5
  review:    text('review'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.courseId, t.userId),  // 1 review per student per course
}));
```

---

### Tabel 18: `discussions`

```typescript
export const discussions = pgTable('discussions', {
  id:         uuid('id').defaultRandom().primaryKey(),
  courseId:   uuid('course_id').notNull()
                .references(() => courses.id, { onDelete: 'cascade' }),
  lessonId:   uuid('lesson_id').references(() => lessons.id),  // null = diskusi kursus umum
  userId:     uuid('user_id').notNull().references(() => users.id),
  title:      varchar('title', { length: 255 }).notNull(),
  body:       text('body').notNull(),
  isPinned:   boolean('is_pinned').default(false),
  replyCount: integer('reply_count').default(0),  // denormalized
  createdAt:  timestamp('created_at').defaultNow(),
  updatedAt:  timestamp('updated_at').defaultNow(),
});
```

---

### Tabel 19: `discussion_replies`

```typescript
export const discussionReplies = pgTable('discussion_replies', {
  id:           uuid('id').defaultRandom().primaryKey(),
  discussionId: uuid('discussion_id').notNull()
                  .references(() => discussions.id, { onDelete: 'cascade' }),
  userId:       uuid('user_id').notNull().references(() => users.id),
  body:         text('body').notNull(),
  createdAt:    timestamp('created_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow(),
});
```

---

### Tabel 20: `announcements`

```typescript
export const announcements = pgTable('announcements', {
  id:        uuid('id').defaultRandom().primaryKey(),
  courseId:  uuid('course_id').notNull()
               .references(() => courses.id, { onDelete: 'cascade' }),
  authorId:  uuid('author_id').notNull().references(() => users.id),
  title:     varchar('title', { length: 255 }).notNull(),
  body:      text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

---

### Tabel 21: `notifications`

```typescript
export const notifications = pgTable('notifications', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull().references(() => users.id),
  type:      notificationTypeEnum('type').notNull(),
  title:     varchar('title', { length: 255 }).notNull(),
  body:      text('body'),
  link:      text('link'),    // URL yang dibuka saat notif diklik
  isRead:    boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

### Tabel 22: `certificates`

```typescript
export const certificates = pgTable('certificates', {
  id:       uuid('id').defaultRandom().primaryKey(),
  userId:   uuid('user_id').notNull().references(() => users.id),
  courseId: uuid('course_id').notNull().references(() => courses.id),
  code:     varchar('code', { length: 50 }).notNull().unique(),  // kode verifikasi publik
  pdfUrl:   text('pdf_url'),  // URL PDF dari MinIO
  issuedAt: timestamp('issued_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.userId, t.courseId),  // 1 sertifikat per student per course
}));
```

---

## Tabel 23-24: Settings & Auth (Fase 4)

### Tabel 23: `user_settings`

```typescript
export const userSettings = pgTable('user_settings', {
  userId:             uuid('user_id').primaryKey()
                        .references(() => users.id, { onDelete: 'cascade' }),
  emailNotifications: boolean('email_notifications').default(true),
  language:           varchar('language', { length: 10 }).default('id'),
  timezone:           varchar('timezone', { length: 50 }).default('Asia/Jakarta'),
  updatedAt:          timestamp('updated_at').defaultNow(),
});
```

---

### Tabel 24: `refresh_tokens`

```typescript
export const refreshTokens = pgTable('refresh_tokens', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull()
               .references(() => users.id, { onDelete: 'cascade' }),
  token:     varchar('token', { length: 500 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## Catatan Migrasi

Setelah update `schema.ts`, jalankan:

```bash
cd backend
npm run db:generate   # generate migration files
npm run db:push       # apply ke database
tsx seed.ts           # seed data dummy
```

Pastikan `.env` sudah punya `DATABASE_URL` yang benar sebelum push.
