import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import {
  courses, categories, users, courseSections, lessons, lessonContents,
  enrollments, courseReviews, quizzes, quizAttempts, quizQuestions, assignments, assignmentSubmissions,
} from '../db/schema';
import { eq, and, ilike, or, desc, asc, sql, count, inArray, isNotNull } from 'drizzle-orm';
import { authMiddleware, roleMiddleware } from '../middleware/jwt';
import { sanitizeHtml } from '../lib/sanitize';

const courseRoutes = new OpenAPIHono();

// ============================================================
// HELPERS
// ============================================================

type JwtPayload = { id: string; role: string; email: string; name: string };

function getPayload(c: any): JwtPayload {
  return c.get('jwtPayload' as never) as JwtPayload;
}

async function findCourseByIdOrSlug(id: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const rows = await db.select().from(courses).where(
    isUuid ? or(eq(courses.id, id), eq(courses.slug, id)) : eq(courses.slug, id)
  ).limit(1);
  return rows[0] ?? null;
}

function assertOwnerOrAdmin(course: any, payload: JwtPayload): boolean {
  return course.instructorId === payload.id || payload.role === 'admin';
}

async function isEnrolled(userId: string, courseId: string) {
  const [row] = await db.select({ id: enrollments.id }).from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return !!row;
}

const InstructorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email().optional(),
  bio: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});

const CategoryOutSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});

const LessonMetaSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: z.string(),
  sortOrder: z.number(),
  isVisible: z.boolean(),
  isFreePreview: z.boolean(),
  durationMinutes: z.number().nullable(),
});

const CourseCardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  shortDescription: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  level: z.string(),
  language: z.string(),
  estimatedHours: z.number().nullable(),
  price: z.number(),
  totalEnrolled: z.number(),
  averageRating: z.number(),
  totalReviews: z.number(),
  status: z.string(),
  instructor: InstructorSchema,
  category: CategoryOutSchema.nullable(),
});

// ============================================================
// GET / — Catalog (public): list kursus published
// ============================================================

const CatalogQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'all_levels']).optional(),
  language: z.string().optional(),
  sort: z.enum(['newest', 'rating', 'popular']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const catalogRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: CatalogQuerySchema },
  responses: {
    200: { description: 'Catalog courses', content: { 'application/json': { schema: z.any() } } },
  },
});

courseRoutes.openapi(catalogRoute, async (c) => {
  const q = c.req.valid('query');

  const conditions = [eq(courses.status, 'published')];
  if (q.search) {
    const pattern = `%${q.search}%`;
    conditions.push(or(ilike(courses.title, pattern), ilike(courses.description, pattern))!);
  }
  if (q.category) conditions.push(eq(categories.slug, q.category));
  if (q.level) conditions.push(eq(courses.level, q.level as any));
  if (q.language) conditions.push(eq(courses.language, q.language));

  const where = and(...conditions);

  const orderBy =
    q.sort === 'rating' ? desc(courses.averageRating) :
    q.sort === 'popular' ? desc(courses.totalEnrolled) :
    desc(courses.publishedAt);

  const offset = (q.page - 1) * q.limit;

  const [totalRow] = await db
    .select({ value: count() })
    .from(courses)
    .leftJoin(categories, eq(courses.categoryId, categories.id))
    .where(where);
  const total = totalRow?.value ?? 0;

  const rows = await db
    .select({ course: courses, instructor: users, category: categories })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .leftJoin(categories, eq(courses.categoryId, categories.id))
    .where(where)
    .orderBy(orderBy, desc(courses.createdAt))
    .limit(q.limit)
    .offset(offset);

  const data = rows.map((r) => ({
    ...r.course,
    instructor: { id: r.instructor.id, name: r.instructor.name, avatarUrl: r.instructor.avatarUrl },
    category: r.category ? { id: r.category.id, name: r.category.name, slug: r.category.slug } : null,
  }));

  return c.json({
    data,
    pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  }, 200);
});

// ============================================================
// GET /my — Kursus milik teacher yang login
// ============================================================

const myCoursesRoute = createRoute({
  method: 'get',
  path: '/my',
  middleware: [authMiddleware],
  responses: { 200: { description: 'My courses', content: { 'application/json': { schema: z.any() } } } },
});

courseRoutes.openapi(myCoursesRoute, async (c) => {
  const payload = getPayload(c);
  const rows = await db
    .select({ course: courses, category: categories })
    .from(courses)
    .leftJoin(categories, eq(courses.categoryId, categories.id))
    .where(eq(courses.instructorId, payload.id))
    .orderBy(desc(courses.createdAt));

  const data = rows.map((r) => ({ ...r.course, category: r.category ? { id: r.category.id, name: r.category.name, slug: r.category.slug } : null }));
  return c.json({ data }, 200);
});

// ============================================================
// GET /admin/all — Semua kursus semua status (admin only)
// ============================================================

const AdminListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['draft', 'pending_review', 'published', 'archived']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

const adminListRoute = createRoute({
  method: 'get',
  path: '/admin/all',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { query: AdminListQuerySchema },
  responses: {
    200: { description: 'All courses (admin)', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
  },
});

courseRoutes.openapi(adminListRoute, async (c) => {
  const q = c.req.valid('query');

  const statusCond = q.status ? eq(courses.status, q.status) : undefined;
  let searchCond;
  if (q.search) {
    const pattern = `%${q.search}%`;
    searchCond = or(ilike(courses.title, pattern), ilike(users.name, pattern));
  }
  const where = and(statusCond, searchCond);

  const offset = (q.page - 1) * q.limit;
  const [totalRow] = await db.select({ value: count() }).from(courses).where(where);
  const total = totalRow?.value ?? 0;

  const rows = await db
    .select({ course: courses, instructor: users, category: categories })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .leftJoin(categories, eq(courses.categoryId, categories.id))
    .where(where)
    .orderBy(desc(courses.createdAt))
    .limit(q.limit)
    .offset(offset);

  const data = rows.map((r) => ({
    ...r.course,
    instructor: { id: r.instructor.id, name: r.instructor.name },
    category: r.category ? { id: r.category.id, name: r.category.name, slug: r.category.slug } : null,
  }));

  return c.json({ data, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } }, 200);
});

// ============================================================
// POST / — Buat kursus baru (teacher/admin)
// ============================================================

const CourseCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  shortDescription: z.string().max(500).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  previewVideoUrl: z.string().url().optional().or(z.literal('')),
  categoryId: z.string().uuid().nullable().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'all_levels']).default('all_levels'),
  language: z.string().length(2).default('id'),
  estimatedHours: z.number().int().min(0).optional(),
  price: z.number().int().min(0).default(0),
  learningOutcomes: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  certificateEnabled: z.boolean().default(false),
});

const createCourseRoute = createRoute({
  method: 'post',
  path: '/',
  middleware: [authMiddleware, roleMiddleware(['teacher', 'admin'])],
  request: { body: { content: { 'application/json': { schema: CourseCreateSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Bad Request' },
  },
});

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200);
}

courseRoutes.openapi(createCourseRoute, async (c) => {
  const payload = getPayload(c);
  const body = c.req.valid('json');
  if (typeof body.description === 'string' && body.description) body.description = sanitizeHtml(body.description);

  // Generate slug unik
  let slug = slugify(body.title);
  let suffix = 1;
  while (true) {
    const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, slug)).limit(1);
    if (!existing) break;
    suffix += 1;
    slug = `${slugify(body.title)}-${suffix}`;
  }

  const [row] = await db.insert(courses).values({
    title: body.title,
    slug,
    description: body.description,
    shortDescription: body.shortDescription,
    thumbnailUrl: body.thumbnailUrl || null,
    previewVideoUrl: body.previewVideoUrl || null,
    instructorId: payload.id,
    categoryId: body.categoryId ?? null,
    level: body.level,
    status: 'draft',
    language: body.language,
    estimatedHours: body.estimatedHours,
    price: body.price,
    learningOutcomes: body.learningOutcomes,
    requirements: body.requirements,
    tags: body.tags,
    certificateEnabled: body.certificateEnabled,
  }).returning();

  return c.json(row as any, 201);
});

// ============================================================
// GET /:id — Detail kursus publik (tanpa konten lesson)
// ============================================================

const detailRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Course detail', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Not Found' },
  },
});

async function buildCourseDetail(courseId: string, includeContent: boolean) {
  const [courseRow] = await db
    .select({ course: courses, instructor: users, category: categories })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .leftJoin(categories, eq(courses.categoryId, categories.id))
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!courseRow) return null;

  const sections = await db
    .select()
    .from(courseSections)
    .where(eq(courseSections.courseId, courseId))
    .orderBy(asc(courseSections.sortOrder));

  const sectionIds = sections.map((s) => s.id);
  const lessonRows = sectionIds.length
    ? await db.select().from(lessons).where(and(inArray(lessons.sectionId, sectionIds), eq(lessons.isVisible, true))).orderBy(asc(lessons.sortOrder))
    : [];

  let contentMap = new Map<string, any>();
  if (includeContent && lessonRows.length) {
    const contents = await db.select().from(lessonContents).where(inArray(lessonContents.lessonId, lessonRows.map((l) => l.id)));
    for (const ct of contents) contentMap.set(ct.lessonId, ct);
  }

  // Metadata quiz/assignment per lesson (untuk course player)
  const lessonIds = lessonRows.map((l) => l.id);
  let quizByLesson = new Map<string, any>();
  let assignmentByLesson = new Map<string, any>();
  if (includeContent && lessonIds.length) {
    const quizRows = await db.select().from(quizzes).where(inArray(quizzes.lessonId, lessonIds));
    for (const q of quizRows) quizByLesson.set(q.lessonId, q);
    const assignmentRows = await db.select().from(assignments).where(inArray(assignments.lessonId, lessonIds));
    for (const a of assignmentRows) assignmentByLesson.set(a.lessonId, a);

    // Jumlah soal + total poin per quiz
    if (quizRows.length) {
      const questionCounts = await db
        .select({ quizId: quizQuestions.quizId, value: count() })
        .from(quizQuestions)
        .where(inArray(quizQuestions.quizId, quizRows.map((q) => q.id)))
        .groupBy(quizQuestions.quizId);
      const totalPoints = await db
        .select({ quizId: quizQuestions.quizId, value: sql<number>`coalesce(sum(${quizQuestions.points}), 0)` })
        .from(quizQuestions)
        .where(inArray(quizQuestions.quizId, quizRows.map((q) => q.id)))
        .groupBy(quizQuestions.quizId);
      const countMap = new Map(questionCounts.map((r) => [r.quizId, r.value]));
      const pointsMap = new Map(totalPoints.map((r) => [r.quizId, Number(r.value)]));
      for (const q of quizRows) {
        const row = quizByLesson.get(q.lessonId);
        if (row) { row.questionCount = countMap.get(q.id) ?? 0; row.totalPoints = pointsMap.get(q.id) ?? 0; }
      }
    }
  }

  // Reviews (untuk halaman detail)
  const [avgRow] = await db.select({ value: sql<number>`coalesce(avg(${courseReviews.rating}), 0)` }).from(courseReviews).where(eq(courseReviews.courseId, courseId));
  const reviewRows = await db
    .select({ review: courseReviews, author: users })
    .from(courseReviews)
    .innerJoin(users, eq(courseReviews.userId, users.id))
    .where(eq(courseReviews.courseId, courseId))
    .orderBy(desc(courseReviews.createdAt))
    .limit(10);

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviewRows) dist[r.review.rating] += 1;

  const sectionsWithLessons = sections.map((s) => ({
    ...s,
    lessons: lessonRows
      .filter((l) => l.sectionId === s.id)
      .map((l) => ({
        ...l,
        content: includeContent ? (contentMap.get(l.id) ?? null) : undefined,
        quiz: includeContent
          ? (() => { const q = quizByLesson.get(l.id); return q ? { id: q.id, timeLimitMin: q.timeLimitMin, maxAttempts: q.maxAttempts, passingScore: q.passingScore, showResultImmediately: q.showResultImmediately } : null; })()
          : undefined,
        assignment: includeContent
          ? (() => { const a = assignmentByLesson.get(l.id); return a ? {
            id: a.id,
            dueDate: a.dueDate,
            maxScore: a.maxScore,
            maxFileSizeMb: a.maxFileSizeMb,
            allowedFileTypes: a.allowedFileTypes,
          } : null; })()
          : undefined,
      })),
  }));

  return {
    ...courseRow.course,
    instructor: { id: courseRow.instructor.id, name: courseRow.instructor.name, bio: courseRow.instructor.bio, avatarUrl: courseRow.instructor.avatarUrl },
    category: courseRow.category ? { id: courseRow.category.id, name: courseRow.category.name, slug: courseRow.category.slug } : null,
    sections: sectionsWithLessons,
    reviews: reviewRows.map((r) => ({
      id: r.review.id,
      rating: r.review.rating,
      review: r.review.review,
      createdAt: r.review.createdAt,
      author: { id: r.author.id, name: r.author.name, avatarUrl: r.author.avatarUrl },
    })),
    ratingDistribution: dist,
  };
}

courseRoutes.openapi(detailRoute, async (c) => {
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);

  const detail = await buildCourseDetail(course.id, false);
  return c.json(detail as any, 200);
});

// ============================================================
// GET /:id/full — Detail + konten lengkap (enrolled/teacher/admin)
// ============================================================

const fullRoute = createRoute({
  method: 'get',
  path: '/{id}/full',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Full course detail', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

courseRoutes.openapi(fullRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);

  const hasAccess = payload.role === 'admin' || course.instructorId === payload.id || (await isEnrolled(payload.id, course.id));
  if (!hasAccess) return c.json({ error: 'Anda harus enrolled untuk mengakses konten lengkap' }, 403);

  const detail = await buildCourseDetail(course.id, true);
  return c.json(detail as any, 200);
});

// ============================================================
// REVIEWS — POST & DELETE /:id/reviews
// ============================================================

async function recalculateCourseRatings(courseId: string) {
  const [stats] = await db
    .select({
      avg: sql<number>`coalesce(avg(${courseReviews.rating}), 0)::float`,
      count: count(),
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId));

  const averageRating = Math.round((stats?.avg ?? 0) * 10) / 10;
  const totalReviews = stats?.count ?? 0;

  await db
    .update(courses)
    .set({ averageRating, totalReviews, updatedAt: new Date() })
    .where(eq(courses.id, courseId));
}

const CourseReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(2000).optional(),
});

const postReviewRoute = createRoute({
  method: 'post',
  path: '/{id}/reviews',
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: CourseReviewSchema } } },
  },
  responses: {
    200: { description: 'Review saved', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Bad Request' },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

courseRoutes.openapi(postReviewRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');

  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);

  // Siswa wajib sudah enrolled untuk bisa memberi review
  const enrolled = await isEnrolled(payload.id, course.id);
  if (!enrolled) {
    return c.json({ error: 'Anda harus terdaftar di kursus ini untuk memberikan ulasan' }, 403);
  }

  // Cek apakah user sudah pernah review kursus ini
  const [existing] = await db
    .select()
    .from(courseReviews)
    .where(and(eq(courseReviews.courseId, course.id), eq(courseReviews.userId, payload.id)))
    .limit(1);

  let savedReview;
  if (existing) {
    const [updated] = await db
      .update(courseReviews)
      .set({
        rating: body.rating,
        review: body.review ? sanitizeHtml(body.review) : null,
        updatedAt: new Date(),
      })
      .where(eq(courseReviews.id, existing.id))
      .returning();
    savedReview = updated;
  } else {
    const [inserted] = await db
      .insert(courseReviews)
      .values({
        courseId: course.id,
        userId: payload.id,
        rating: body.rating,
        review: body.review ? sanitizeHtml(body.review) : null,
      })
      .returning();
    savedReview = inserted;
  }

  // Recalculate average rating & total reviews
  await recalculateCourseRatings(course.id);

  return c.json({
    message: existing ? 'Ulasan berhasil diperbarui' : 'Ulasan berhasil dikirim',
    review: savedReview,
  }, 200);
});

const deleteReviewRoute = createRoute({
  method: 'delete',
  path: '/{id}/reviews/{reviewId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string(), reviewId: z.string().uuid() }),
  },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

courseRoutes.openapi(deleteReviewRoute, async (c) => {
  const payload = getPayload(c);
  const { id, reviewId } = c.req.valid('param');

  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);

  const [review] = await db
    .select()
    .from(courseReviews)
    .where(and(eq(courseReviews.id, reviewId), eq(courseReviews.courseId, course.id)))
    .limit(1);

  if (!review) return c.json({ error: 'Ulasan tidak ditemukan' }, 404);

  const isAuthor = review.userId === payload.id;
  const isAdmin = payload.role === 'admin';
  if (!isAuthor && !isAdmin) {
    return c.json({ error: 'Anda tidak memiliki hak untuk menghapus ulasan ini' }, 403);
  }

  await db.delete(courseReviews).where(eq(courseReviews.id, reviewId));
  await recalculateCourseRatings(course.id);

  return c.json({ message: 'Ulasan berhasil dihapus' }, 200);
});

// ============================================================
// PUT /:id — Edit kursus (owner/admin)
// ============================================================

const CourseUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  shortDescription: z.string().max(500).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  previewVideoUrl: z.string().url().optional().or(z.literal('')),
  categoryId: z.string().uuid().nullable().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'all_levels']).optional(),
  language: z.string().length(2).optional(),
  estimatedHours: z.number().int().min(0).optional(),
  price: z.number().int().min(0).optional(),
  learningOutcomes: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  certificateEnabled: z.boolean().optional(),
});

const updateCourseRoute = createRoute({
  method: 'put',
  path: '/{id}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: CourseUpdateSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

courseRoutes.openapi(updateCourseRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  if (typeof body.description === 'string' && body.description) body.description = sanitizeHtml(body.description);
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!assertOwnerOrAdmin(course, payload)) return c.json({ error: 'Anda tidak memiliki akses untuk edit kursus ini' }, 403);

  const [row] = await db.update(courses).set({ ...body }).where(eq(courses.id, course.id)).returning();
  return c.json(row as any, 200);
});

// ============================================================
// DELETE /:id — Hapus kursus (owner/admin)
// ============================================================

const deleteCourseRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: { 204: { description: 'Deleted' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

courseRoutes.openapi(deleteCourseRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!assertOwnerOrAdmin(course, payload)) return c.json({ error: 'Anda tidak memiliki akses untuk hapus kursus ini' }, 403);

  await db.delete(courses).where(eq(courses.id, course.id));
  return c.body(null, 204);
});

// ============================================================
// PATCH /:id/submit — draft → pending_review (owner)
// ============================================================

const submitRoute = createRoute({
  method: 'patch',
  path: '/{id}/submit',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Submitted' }, 400: { description: 'Bad Request' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

courseRoutes.openapi(submitRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!assertOwnerOrAdmin(course, payload)) return c.json({ error: 'Tidak diizinkan' }, 403);
  if (course.status !== 'draft') return c.json({ error: `Kursus berstatus ${course.status}, hanya draft yang bisa disubmit` }, 400);

  const [row] = await db.update(courses).set({ status: 'pending_review' }).where(eq(courses.id, course.id)).returning();
  return c.json(row as any, 200);
});

// ============================================================
// PATCH /:id/publish — pending_review → published (admin)
// ============================================================

const publishRoute = createRoute({
  method: 'patch',
  path: '/{id}/publish',
  middleware: [authMiddleware, roleMiddleware(['admin'])],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Published' }, 400: { description: 'Bad Request' }, 404: { description: 'Not Found' } },
});

courseRoutes.openapi(publishRoute, async (c) => {
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (course.status !== 'pending_review') return c.json({ error: `Hanya kursus pending_review yang bisa dipublish (status saat ini: ${course.status})` }, 400);

  const [row] = await db.update(courses).set({ status: 'published', publishedAt: new Date() }).where(eq(courses.id, course.id)).returning();
  return c.json(row as any, 200);
});

// ============================================================
// PATCH /:id/archive — Arsipkan (owner/admin)
// ============================================================

const archiveRoute = createRoute({
  method: 'patch',
  path: '/{id}/archive',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Archived' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

courseRoutes.openapi(archiveRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!assertOwnerOrAdmin(course, payload)) return c.json({ error: 'Tidak diizinkan' }, 403);

  const [row] = await db.update(courses).set({ status: 'archived' }).where(eq(courses.id, course.id)).returning();
  return c.json(row as any, 200);
});

// ============================================================
// GET /:id/students — List student enrolled (teacher/admin)
// ============================================================

const studentsRoute = createRoute({
  method: 'get',
  path: '/{id}/students',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Enrolled students', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

courseRoutes.openapi(studentsRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!assertOwnerOrAdmin(course, payload)) return c.json({ error: 'Tidak diizinkan' }, 403);

  const rows = await db
    .select({ user: users, enrollment: enrollments })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, course.id))
    .orderBy(asc(users.name));

  const data = rows.map((r) => ({
    id: r.user.id,
    enrollmentId: r.enrollment.id,
    name: r.user.name,
    email: r.user.email,
    avatarUrl: r.user.avatarUrl,
    enrolledAt: r.enrollment.enrolledAt,
    progress: r.enrollment.progress,
    status: r.enrollment.status,
  }));
  return c.json({ data }, 200);
});

// PATCH /{id}/students/{studentId}/status — Toggle status enrollment student (active <-> suspended)
const toggleStudentStatusRoute = createRoute({
  method: 'patch',
  path: '/{id}/students/{studentId}/status',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string(), studentId: z.string() }) },
  responses: { 200: { description: 'Status updated' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

courseRoutes.openapi(toggleStudentStatusRoute, async (c) => {
  const payload = getPayload(c);
  const { id, studentId } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!assertOwnerOrAdmin(course, payload)) return c.json({ error: 'Tidak diizinkan' }, 403);

  const [enrollment] = await db.select().from(enrollments)
    .where(and(eq(enrollments.courseId, course.id), eq(enrollments.userId, studentId)))
    .limit(1);
  if (!enrollment) return c.json({ error: 'Data pendaftaran tidak ditemukan' }, 404);

  const newStatus = enrollment.status === 'suspended' ? 'active' : 'suspended';
  await db.update(enrollments).set({ status: newStatus, updatedAt: new Date() }).where(eq(enrollments.id, enrollment.id));

  return c.json({ message: `Status berhasil diubah menjadi ${newStatus}`, status: newStatus }, 200);
});

// ============================================================
// GET /:id/analytics — Stats kursus (placeholder Fase 4)
// ============================================================

const analyticsRoute = createRoute({
  method: 'get',
  path: '/{id}/analytics',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Course analytics', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

courseRoutes.openapi(analyticsRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!assertOwnerOrAdmin(course, payload)) return c.json({ error: 'Tidak diizinkan' }, 403);

  const [enrollRow] = await db.select({ value: count() }).from(enrollments).where(eq(enrollments.courseId, course.id));
  const [completedRow] = await db.select({ value: count() }).from(enrollments).where(and(eq(enrollments.courseId, course.id), eq(enrollments.status, 'completed')));

  return c.json({
    totalEnrolled: enrollRow?.value ?? 0,
    completed: completedRow?.value ?? 0,
    completionRate: (enrollRow?.value ?? 0) > 0 ? Math.round(((completedRow?.value ?? 0) / (enrollRow?.value ?? 0)) * 100) : 0,
    averageRating: course.averageRating,
    totalReviews: course.totalReviews,
  }, 200);
});

// ============================================================
// GET /:id/gradebook — Nilai semua student
// ============================================================

const gradebookRoute = createRoute({
  method: 'get',
  path: '/{id}/gradebook',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Gradebook', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

courseRoutes.openapi(gradebookRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!assertOwnerOrAdmin(course, payload)) return c.json({ error: 'Tidak diizinkan' }, 403);

  const rows = await db
    .select({ user: users, enrollment: enrollments })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, course.id))
    .orderBy(asc(users.name));

  // Kumpulkan lesson ID milik kursus (quizzes & assignments terikat ke lesson)
  const sectionsOfCourse = await db.select({ id: courseSections.id }).from(courseSections).where(eq(courseSections.courseId, course.id));
  const lessonsOfCourse = sectionsOfCourse.length > 0
    ? await db.select({ id: lessons.id }).from(lessons).where(inArray(lessons.sectionId, sectionsOfCourse.map((s) => s.id)))
    : [];
  const lessonIds = lessonsOfCourse.map((l) => l.id);

  // Skor kuis terbaik per user (persentase tertinggi tiap kuis, lalu dirata-ratakan)
  const quizAgg = new Map<string, { totalPct: number; count: number }>();
  let quizzesInCourse: { id: string }[] = [];
  if (lessonIds.length > 0) {
    quizzesInCourse = await db.select({ id: quizzes.id }).from(quizzes).where(inArray(quizzes.lessonId, lessonIds));
  }
  if (quizzesInCourse.length > 0) {
    const bestPerUserQuiz = new Map<string, number>();
    const attempts = await db
      .select({ userId: quizAttempts.userId, quizId: quizAttempts.quizId, percentage: quizAttempts.percentage })
      .from(quizAttempts)
      .where(and(inArray(quizAttempts.quizId, quizzesInCourse.map((q) => q.id)), isNotNull(quizAttempts.percentage)));
    for (const a of attempts) {
      if (a.percentage == null) continue;
      const key = `${a.userId}:${a.quizId}`;
      const prev = bestPerUserQuiz.get(key);
      if (prev === undefined || a.percentage > prev) bestPerUserQuiz.set(key, a.percentage);
    }
    for (const [key, pct] of bestPerUserQuiz) {
      const userId = key.split(':')[0];
      const agg = quizAgg.get(userId) ?? { totalPct: 0, count: 0 };
      agg.totalPct += pct; agg.count += 1;
      quizAgg.set(userId, agg);
    }
  }

  // Rata-rata nilai tugas yang sudah dinilai per user
  const assignAgg = new Map<string, { totalScore: number; count: number }>();
  let assignmentsInCourse: { id: string }[] = [];
  if (lessonIds.length > 0) {
    assignmentsInCourse = await db.select({ id: assignments.id }).from(assignments).where(inArray(assignments.lessonId, lessonIds));
  }
  if (assignmentsInCourse.length > 0) {
    const gradedSubs = await db
      .select({ userId: assignmentSubmissions.userId, score: assignmentSubmissions.score })
      .from(assignmentSubmissions)
      .where(and(
        inArray(assignmentSubmissions.assignmentId, assignmentsInCourse.map((a) => a.id)),
        eq(assignmentSubmissions.status, 'graded'),
      ));
    for (const s of gradedSubs) {
      if (s.score == null) continue;
      const agg = assignAgg.get(s.userId) ?? { totalScore: 0, count: 0 };
      agg.totalScore += s.score; agg.count += 1;
      assignAgg.set(s.userId, agg);
    }
  }

  const data = rows.map((r) => {
    const q = quizAgg.get(r.user.id);
    const a = assignAgg.get(r.user.id);
    const quizAvg = q && q.count > 0 ? Math.round(q.totalPct / q.count) : null;
    const assignmentAvg = a && a.count > 0 ? Math.round(a.totalScore / a.count) : null;
    let finalGrade: number | null = null;
    if (quizAvg !== null && assignmentAvg !== null) finalGrade = Math.round(0.6 * quizAvg + 0.4 * assignmentAvg);
    else if (quizAvg !== null) finalGrade = quizAvg;
    else if (assignmentAvg !== null) finalGrade = assignmentAvg;

    return {
      userId: r.user.id,
      name: r.user.name,
      email: r.user.email,
      progress: r.enrollment.progress,
      status: r.enrollment.status,
      quizCount: q?.count ?? 0,
      assignmentCount: a?.count ?? 0,
      quizAvg,
      assignmentAvg,
      finalGrade,
    };
  });
  return c.json({ data }, 200);
});

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function calculateLetterGrade(score: number | null): string {
  if (score === null) return '-';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

// GET /{id}/students/export — Export CSV data student enrolled
const exportStudentsRoute = createRoute({
  method: 'get',
  path: '/{id}/students/export',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'CSV export' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

courseRoutes.openapi(exportStudentsRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!assertOwnerOrAdmin(course, payload)) return c.json({ error: 'Tidak diizinkan' }, 403);

  const rows = await db
    .select({ user: users, enrollment: enrollments })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, course.id))
    .orderBy(asc(users.name));

  const headers = ['ID Siswa', 'Nama Siswa', 'Email', 'Tanggal Terdaftar', 'Progress (%)', 'Status'];
  const lines = [headers.map(escapeCsv).join(',')];

  for (const r of rows) {
    lines.push([
      r.user.id,
      r.user.name,
      r.user.email,
      r.enrollment.enrolledAt ? new Date(r.enrollment.enrolledAt).toISOString().slice(0, 10) : '-',
      Math.round(r.enrollment.progress ?? 0),
      r.enrollment.status,
    ].map(escapeCsv).join(','));
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="students-${course.slug}.csv"`,
    },
  });
});

// GET /{id}/gradebook/export — Export CSV gradebook
const exportGradebookRoute = createRoute({
  method: 'get',
  path: '/{id}/gradebook/export',
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'CSV export' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

courseRoutes.openapi(exportGradebookRoute, async (c) => {
  const payload = getPayload(c);
  const { id } = c.req.valid('param');
  const course = await findCourseByIdOrSlug(id);
  if (!course) return c.json({ error: 'Kursus tidak ditemukan' }, 404);
  if (!assertOwnerOrAdmin(course, payload)) return c.json({ error: 'Tidak diizinkan' }, 403);

  const rows = await db
    .select({ user: users, enrollment: enrollments })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, course.id))
    .orderBy(asc(users.name));

  const sectionsOfCourse = await db.select({ id: courseSections.id }).from(courseSections).where(eq(courseSections.courseId, course.id));
  const lessonsOfCourse = sectionsOfCourse.length > 0
    ? await db.select({ id: lessons.id }).from(lessons).where(inArray(lessons.sectionId, sectionsOfCourse.map((s) => s.id)))
    : [];
  const lessonIds = lessonsOfCourse.map((l) => l.id);

  const quizAgg = new Map<string, { totalPct: number; count: number }>();
  let quizzesInCourse: { id: string }[] = [];
  if (lessonIds.length > 0) {
    quizzesInCourse = await db.select({ id: quizzes.id }).from(quizzes).where(inArray(quizzes.lessonId, lessonIds));
  }
  if (quizzesInCourse.length > 0) {
    const bestPerQuiz = new Map<string, number>();
    const attempts = await db
      .select({ userId: quizAttempts.userId, quizId: quizAttempts.quizId, pct: quizAttempts.percentage })
      .from(quizAttempts)
      .where(and(
        inArray(quizAttempts.quizId, quizzesInCourse.map((q) => q.id)),
        isNotNull(quizAttempts.percentage),
      ));
    for (const a of attempts) {
      if (a.pct == null) continue;
      const key = `${a.userId}:${a.quizId}`;
      const prev = bestPerQuiz.get(key) ?? -1;
      if (a.pct > prev) bestPerQuiz.set(key, a.pct);
    }
    for (const [key, pct] of bestPerQuiz.entries()) {
      const [userId] = key.split(':');
      const agg = quizAgg.get(userId) ?? { totalPct: 0, count: 0 };
      agg.totalPct += pct; agg.count += 1;
      quizAgg.set(userId, agg);
    }
  }

  const assignAgg = new Map<string, { totalScore: number; count: number }>();
  let assignmentsInCourse: { id: string }[] = [];
  if (lessonIds.length > 0) {
    assignmentsInCourse = await db.select({ id: assignments.id }).from(assignments).where(inArray(assignments.lessonId, lessonIds));
  }
  if (assignmentsInCourse.length > 0) {
    const gradedSubs = await db
      .select({ userId: assignmentSubmissions.userId, score: assignmentSubmissions.score })
      .from(assignmentSubmissions)
      .where(and(
        inArray(assignmentSubmissions.assignmentId, assignmentsInCourse.map((a) => a.id)),
        eq(assignmentSubmissions.status, 'graded'),
      ));
    for (const s of gradedSubs) {
      if (s.score == null) continue;
      const agg = assignAgg.get(s.userId) ?? { totalScore: 0, count: 0 };
      agg.totalScore += s.score; agg.count += 1;
      assignAgg.set(s.userId, agg);
    }
  }

  const headers = ['ID Siswa', 'Nama Siswa', 'Email', 'Progress (%)', 'Jumlah Kuis', 'Rata-rata Kuis (%)', 'Jumlah Tugas', 'Rata-rata Tugas', 'Nilai Akhir', 'Grade Huruf'];
  const lines = [headers.map(escapeCsv).join(',')];

  for (const r of rows) {
    const q = quizAgg.get(r.user.id);
    const a = assignAgg.get(r.user.id);
    const quizAvg = q && q.count > 0 ? Math.round(q.totalPct / q.count) : null;
    const assignmentAvg = a && a.count > 0 ? Math.round(a.totalScore / a.count) : null;
    let finalGrade: number | null = null;
    if (quizAvg !== null && assignmentAvg !== null) finalGrade = Math.round(0.6 * quizAvg + 0.4 * assignmentAvg);
    else if (quizAvg !== null) finalGrade = quizAvg;
    else if (assignmentAvg !== null) finalGrade = assignmentAvg;

    lines.push([
      r.user.id,
      r.user.name,
      r.user.email,
      Math.round(r.enrollment.progress ?? 0),
      q?.count ?? 0,
      quizAvg !== null ? quizAvg : '-',
      a?.count ?? 0,
      assignmentAvg !== null ? assignmentAvg : '-',
      finalGrade !== null ? finalGrade : '-',
      calculateLetterGrade(finalGrade),
    ].map(escapeCsv).join(','));
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gradebook-${course.slug}.csv"`,
    },
  });
});

export default courseRoutes;
