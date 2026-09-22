import { pgTable, uuid, varchar, text, timestamp, pgEnum, integer, real, boolean, bigint, unique, primaryKey } from 'drizzle-orm/pg-core';

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
  letterGrade:        varchar('letter_grade', { length: 5 }),
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
  isPinned:  boolean('is_pinned').default(false),
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

// ============================================================
// TABEL 25: password_reset_tokens (forgot/reset password via email)
// ============================================================
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:     varchar('token', { length: 500 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt:    timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
