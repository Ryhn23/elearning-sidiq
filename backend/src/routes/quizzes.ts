import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import {
  courses, courseSections, lessons, quizzes, quizQuestions, quizOptions,
  quizAttempts, quizAnswers, lessonProgress, enrollments, users,
} from '../db/schema';
import { eq, and, asc, desc, count, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/jwt';
import { recalculateProgress } from '../services/progress';
import { sendQuizResult } from '../services/email';

const quizRoutes = new OpenAPIHono();

type JwtPayload = { id: string; role: string; email: string; name: string };

// ============================================================
// HELPERS
// ============================================================

async function getQuizContext(quizId: string) {
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) return null;
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, quiz.lessonId)).limit(1);
  if (!lesson) return null;
  const [section] = await db.select().from(courseSections).where(eq(courseSections.id, lesson.sectionId)).limit(1);
  if (!section) return null;
  const [course] = await db.select().from(courses).where(eq(courses.id, section.courseId)).limit(1);
  if (!course) return null;
  return { quiz, lesson, section, course };
}

function canManage(course: any, payload: JwtPayload): boolean {
  return payload.role === 'admin' || course.instructorId === payload.id;
}

async function isEnrolled(userId: string, courseId: string) {
  const [row] = await db.select({ id: enrollments.id }).from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return !!row;
}

/** Serialisasi soal TANPA bocoran jawaban benar (untuk client student). */
async function getQuestionsForAttempt(quizId: string, shuffleOptions: boolean) {
  const questions = await db.select().from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.sortOrder));

  const result = [];
  for (const q of questions) {
    let options = await db.select().from(quizOptions)
      .where(eq(quizOptions.questionId, q.id))
      .orderBy(asc(quizOptions.sortOrder));
    if (shuffleOptions) {
      options = [...options].sort(() => Math.random() - 0.5);
    }
    result.push({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      imageUrl: q.imageUrl,
      points: q.points,
      sortOrder: q.sortOrder,
      options: options.map((o) => ({ id: o.id, optionText: o.optionText, sortOrder: o.sortOrder })),
    });
  }
  return result;
}

/** Serialisasi soal DENGAN jawaban benar (untuk review hasil & teacher). */
async function getQuestionsWithAnswers(quizId: string) {
  const questions = await db.select().from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.sortOrder));

  const result = [];
  for (const q of questions) {
    const options = await db.select().from(quizOptions)
      .where(eq(quizOptions.questionId, q.id))
      .orderBy(asc(quizOptions.sortOrder));
    result.push({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      imageUrl: q.imageUrl,
      points: q.points,
      sortOrder: q.sortOrder,
      explanation: q.explanation,
      options: options.map((o) => ({ id: o.id, optionText: o.optionText, isCorrect: o.isCorrect, sortOrder: o.sortOrder })),
    });
  }
  return result;
}

// ============================================================
// POST /lessons/:lessonId — Buat quiz (owner/admin)
// ============================================================
const CreateQuizSchema = z.object({
  timeLimitMin: z.number().int().min(1).optional(),
  maxAttempts: z.number().int().min(1).default(3),
  passingScore: z.number().int().min(0).max(100).default(70),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showResultImmediately: z.boolean().default(true),
});

const createQuizRoute = createRoute({
  method: 'post',
  path: '/lessons/{lessonId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ lessonId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: CreateQuizSchema } } },
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
    409: { description: 'Conflict' },
  },
});

quizRoutes.openapi(createQuizRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { lessonId } = c.req.valid('param');
  const body = c.req.valid('json');

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson) return c.json({ error: 'Lesson tidak ditemukan' }, 404);

  const ctx = await getQuizContextByLesson(lesson.sectionId);
  if (!ctx) return c.json({ error: 'Konteks kursus tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [existing] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).limit(1);
  if (existing) return c.json({ error: 'Lesson ini sudah memiliki quiz' }, 409);

  const [row] = await db.insert(quizzes).values({
    lessonId,
    timeLimitMin: body.timeLimitMin,
    maxAttempts: body.maxAttempts,
    passingScore: body.passingScore,
    shuffleQuestions: body.shuffleQuestions,
    shuffleOptions: body.shuffleOptions,
    showResultImmediately: body.showResultImmediately,
  }).returning();

  return c.json(row as any, 201);
});

async function getQuizContextByLesson(sectionId: string) {
  const [section] = await db.select().from(courseSections).where(eq(courseSections.id, sectionId)).limit(1);
  if (!section) return null;
  const [course] = await db.select().from(courses).where(eq(courses.id, section.courseId)).limit(1);
  if (!course) return null;
  return { section, course };
}

// ============================================================
// PUT /:quizId — Edit setting quiz (owner/admin)
// ============================================================
const UpdateQuizSchema = z.object({
  timeLimitMin: z.number().int().min(1).nullable().optional(),
  maxAttempts: z.number().int().min(1).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showResultImmediately: z.boolean().optional(),
});

const updateQuizRoute = createRoute({
  method: 'put',
  path: '/{quizId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ quizId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateQuizSchema } } },
  },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

quizRoutes.openapi(updateQuizRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { quizId } = c.req.valid('param');
  const body = c.req.valid('json');

  const ctx = await getQuizContext(quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) values[k] = v;
  }
  const [row] = await db.update(quizzes).set(values as any).where(eq(quizzes.id, quizId)).returning();
  return c.json(row as any, 200);
});

// ============================================================
// GET /:quizId — Detail quiz + soal (owner/admin)
// ============================================================
const getQuizRoute = createRoute({
  method: 'get',
  path: '/{quizId}',
  middleware: [authMiddleware],
  request: { params: z.object({ quizId: z.string().uuid() }) },
  responses: { 200: { description: 'Quiz detail', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

quizRoutes.openapi(getQuizRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { quizId } = c.req.valid('param');

  const ctx = await getQuizContext(quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const questions = await getQuestionsWithAnswers(quizId);
  return c.json({ quiz: ctx.quiz, lesson: ctx.lesson, questions }, 200);
});

// ============================================================
// POST /:quizId/questions — Tambah soal (owner/admin)
// ============================================================
const OptionSchema = z.object({
  optionText: z.string().min(1).max(500),
  isCorrect: z.boolean().default(false),
});

const CreateQuestionSchema = z.object({
  type: z.enum(['multiple_choice', 'multiple_answer', 'true_false', 'short_answer', 'essay']),
  questionText: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional().or(z.literal('')),
  points: z.number().positive().default(1),
  explanation: z.string().max(2000).optional(),
  options: z.array(OptionSchema).default([]),
});

const createQuestionRoute = createRoute({
  method: 'post',
  path: '/{quizId}/questions',
  middleware: [authMiddleware],
  request: {
    params: z.object({ quizId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: CreateQuestionSchema } } },
  },
  responses: { 201: { description: 'Created', content: { 'application/json': { schema: z.any() } } }, 400: { description: 'Bad Request' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

quizRoutes.openapi(createQuestionRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { quizId } = c.req.valid('param');
  const body = c.req.valid('json');

  const ctx = await getQuizContext(quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const validation = validateQuestion(body.type, body.options);
  if (validation) return c.json({ error: validation }, 400);

  const [lastRow] = await db.select({ value: count() }).from(quizQuestions).where(eq(quizQuestions.quizId, quizId));
  const sortOrder = lastRow?.value ?? 0;

  const [question] = await db.insert(quizQuestions).values({
    quizId,
    type: body.type,
    questionText: body.questionText,
    imageUrl: body.imageUrl || null,
    points: body.points,
    explanation: body.explanation || null,
    sortOrder,
  }).returning();

  for (let i = 0; i < body.options.length; i++) {
    await db.insert(quizOptions).values({
      questionId: question.id,
      optionText: body.options[i].optionText,
      isCorrect: body.options[i].isCorrect,
      sortOrder: i,
    });
  }

  const questions = await getQuestionsWithAnswers(quizId);
  return c.json({ question: questions.find((q) => q.id === question.id), totalQuestions: questions.length }, 201);
});

function validateQuestion(type: string, options: { optionText: string; isCorrect: boolean }[]): string | null {
  const correctCount = options.filter((o) => o.isCorrect).length;
  switch (type) {
    case 'multiple_choice':
      if (options.length < 2 || correctCount !== 1) return 'Multiple choice butuh minimal 2 pilihan dengan tepat 1 jawaban benar';
      break;
    case 'multiple_answer':
      if (options.length < 2 || correctCount < 2) return 'Multiple answer butuh minimal 2 pilihan dengan minimal 2 jawaban benar';
      break;
    case 'true_false':
      if (options.length !== 2 || correctCount !== 1) return 'True/False butuh tepat 2 pilihan dengan 1 jawaban benar';
      break;
    case 'short_answer':
      if (options.length !== 1 || correctCount !== 1) return 'Short answer butuh tepat 1 opsi sebagai jawaban benar';
      break;
    case 'essay':
      if (options.length > 0) return 'Essay tidak memiliki opsi jawaban';
      break;
  }
  return null;
}

// ============================================================
// PUT /:quizId/questions/:questionId — Edit soal (owner/admin)
// ============================================================
const UpdateQuestionSchema = z.object({
  questionText: z.string().min(1).max(2000).optional(),
  imageUrl: z.string().url().nullable().optional(),
  points: z.number().positive().optional(),
  explanation: z.string().max(2000).nullable().optional(),
  options: z.array(OptionSchema).optional(),
});

const updateQuestionRoute = createRoute({
  method: 'put',
  path: '/{quizId}/questions/{questionId}',
  middleware: [authMiddleware],
  request: {
    params: z.object({ quizId: z.string().uuid(), questionId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateQuestionSchema } } },
  },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } }, 400: { description: 'Bad Request' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

quizRoutes.openapi(updateQuestionRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { quizId, questionId } = c.req.valid('param');
  const body = c.req.valid('json');

  const ctx = await getQuizContext(quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [question] = await db.select().from(quizQuestions).where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId))).limit(1);
  if (!question) return c.json({ error: 'Soal tidak ditemukan' }, 404);

  const values: Record<string, unknown> = {};
  for (const k of ['questionText', 'imageUrl', 'points', 'explanation'] as const) {
    if ((body as any)[k] !== undefined) values[k] = (body as any)[k];
  }
  await db.update(quizQuestions).set(values as any).where(eq(quizQuestions.id, questionId));

  if (body.options) {
    const validation = validateQuestion(question.type, body.options);
    if (validation) return c.json({ error: validation }, 400);
    await db.delete(quizOptions).where(eq(quizOptions.questionId, questionId));
    for (let i = 0; i < body.options.length; i++) {
      await db.insert(quizOptions).values({
        questionId,
        optionText: body.options[i].optionText,
        isCorrect: body.options[i].isCorrect,
        sortOrder: i,
      });
    }
  }

  const questions = await getQuestionsWithAnswers(quizId);
  return c.json({ question: questions.find((q) => q.id === questionId), totalQuestions: questions.length }, 200);
});

// ============================================================
// DELETE /:quizId/questions/:questionId — Hapus soal (owner/admin)
// ============================================================
const deleteQuestionRoute = createRoute({
  method: 'delete',
  path: '/{quizId}/questions/{questionId}',
  middleware: [authMiddleware],
  request: { params: z.object({ quizId: z.string().uuid(), questionId: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

quizRoutes.openapi(deleteQuestionRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { quizId, questionId } = c.req.valid('param');

  const ctx = await getQuizContext(quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const [row] = await db.delete(quizQuestions).where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId))).returning({ id: quizQuestions.id });
  if (!row) return c.json({ error: 'Soal tidak ditemukan' }, 404);
  return c.body(null, 204);
});

// ============================================================
// PATCH /:quizId/questions/reorder — Ubah urutan soal (owner/admin)
// ============================================================
const ReorderSchema = z.object({ order: z.array(z.string().uuid()).min(1) });

const reorderQuestionsRoute = createRoute({
  method: 'patch',
  path: '/{quizId}/questions/reorder',
  middleware: [authMiddleware],
  request: {
    params: z.object({ quizId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: ReorderSchema } } },
  },
  responses: { 200: { description: 'Reordered' }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

quizRoutes.openapi(reorderQuestionsRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { quizId } = c.req.valid('param');
  const body = c.req.valid('json');

  const ctx = await getQuizContext(quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  for (let i = 0; i < body.order.length; i++) {
    await db.update(quizQuestions).set({ sortOrder: i }).where(eq(quizQuestions.id, body.order[i]));
  }
  return c.json({ message: 'Urutan soal diperbarui' }, 200);
});

// ============================================================
// POST /:quizId/start — Mulai attempt (enrolled/owner/admin)
// ============================================================
const startQuizRoute = createRoute({
  method: 'post',
  path: '/{quizId}/start',
  middleware: [authMiddleware],
  request: { params: z.object({ quizId: z.string().uuid() }) },
  responses: {
    200: { description: 'Attempt started', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
  },
});

quizRoutes.openapi(startQuizRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { quizId } = c.req.valid('param');

  const ctx = await getQuizContext(quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);

  const hasAccess = canManage(ctx.course, payload) || (await isEnrolled(payload.id, ctx.course.id));
  if (!hasAccess) return c.json({ error: 'Anda harus enrolled untuk mengambil quiz ini' }, 403);

  // Cek attempt aktif (belum submit) → resume
  const [activeAttempt] = await db.select().from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, payload.id), sql`${quizAttempts.submittedAt} IS NULL`))
    .limit(1);

  if (activeAttempt) {
    const questions = await getQuestionsForAttempt(quizId, !!ctx.quiz.shuffleOptions);
    return c.json({
      attemptId: activeAttempt.id,
      attemptNumber: activeAttempt.attemptNumber,
      timeLimitMin: ctx.quiz.timeLimitMin,
      startedAt: activeAttempt.startedAt,
      questions,
    }, 200);
  }

  // Cek max attempts
  const [countRow] = await db.select({ value: count() }).from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, payload.id)));
  if ((countRow?.value ?? 0) >= (ctx.quiz.maxAttempts ?? 3)) {
    return c.json({ error: `Maksimal ${ctx.quiz.maxAttempts} attempt sudah tercapai` }, 403);
  }

  const [attempt] = await db.insert(quizAttempts).values({
    quizId,
    userId: payload.id,
    attemptNumber: (countRow?.value ?? 0) + 1,
  }).returning();

  const questions = await getQuestionsForAttempt(quizId, !!ctx.quiz.shuffleOptions);
  return c.json({
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    timeLimitMin: ctx.quiz.timeLimitMin,
    startedAt: attempt.startedAt,
    questions,
  }, 200);
});

// ============================================================
// POST /attempts/:attemptId/submit — Submit jawaban (enrolled)
// ============================================================
const AnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionIds: z.array(z.string().uuid()).default([]),
  textAnswer: z.string().max(5000).optional(),
});

const SubmitAttemptSchema = z.object({
  answers: z.array(AnswerSchema).min(1),
});

const submitAttemptRoute = createRoute({
  method: 'post',
  path: '/attempts/{attemptId}/submit',
  middleware: [authMiddleware],
  request: {
    params: z.object({ attemptId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: SubmitAttemptSchema } } },
  },
  responses: {
    200: { description: 'Submitted', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Forbidden' },
    404: { description: 'Not Found' },
    409: { description: 'Conflict' },
  },
});

quizRoutes.openapi(submitAttemptRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { attemptId } = c.req.valid('param');
  const body = c.req.valid('json');

  const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).limit(1);
  if (!attempt) return c.json({ error: 'Attempt tidak ditemukan' }, 404);

  const ctx = await getQuizContext(attempt.quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);

  const isOwner = attempt.userId === payload.id;
  const isTeacher = canManage(ctx.course, payload);
  if (!isOwner && !isTeacher) return c.json({ error: 'Anda tidak memiliki akses' }, 403);
  if (attempt.submittedAt) return c.json({ error: 'Attempt sudah disubmit' }, 409);

  const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, attempt.quizId));
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  let totalEarned = 0;
  let totalMax = 0;

  for (const ans of body.answers) {
    const question = questionMap.get(ans.questionId);
    if (!question) continue;
    totalMax += question.points ?? 0;

    const options = await db.select().from(quizOptions).where(eq(quizOptions.questionId, question.id));
    const optionMap = new Map(options.map((o) => [o.id, o]));

    let isCorrect: boolean | null = null;
    let earned = 0;

    switch (question.type) {
      case 'multiple_choice':
      case 'true_false': {
        const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id);
        const selected = ans.selectedOptionIds;
        isCorrect = selected.length === 1 && correctIds.includes(selected[0]);
        earned = isCorrect ? (question.points ?? 0) : 0;
        break;
      }
      case 'multiple_answer': {
        const correctSet = new Set(options.filter((o) => o.isCorrect).map((o) => o.id));
        const selectedSet = new Set(ans.selectedOptionIds);
        isCorrect = correctSet.size > 0 &&
          [...correctSet].every((id) => selectedSet.has(id)) &&
          [...selectedSet].every((id) => correctSet.has(id));
        earned = isCorrect ? (question.points ?? 0) : 0;
        break;
      }
      case 'short_answer': {
        const correctOption = options.find((o) => o.isCorrect);
        if (correctOption && ans.textAnswer) {
          isCorrect = ans.textAnswer.trim().toLowerCase() === correctOption.optionText.trim().toLowerCase();
        } else {
          isCorrect = false;
        }
        earned = isCorrect ? (question.points ?? 0) : 0;
        break;
      }
      case 'essay': {
        // Dikoreksi manual oleh teacher — tidak auto-grade
        isCorrect = null;
        earned = 0;
        break;
      }
    }

    totalEarned += earned;

    await db.insert(quizAnswers).values({
      attemptId,
      questionId: question.id,
      selectedOptionIds: ans.selectedOptionIds,
      textAnswer: ans.textAnswer || null,
      isCorrect,
      pointsEarned: earned,
    });
  }

  const percentage = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
  const isPassed = percentage >= (ctx.quiz.passingScore ?? 70);
  const timeTakenSec = Math.floor((Date.now() - new Date(attempt.startedAt ?? new Date()).getTime()) / 1000);

  await db.update(quizAttempts).set({
    score: totalEarned,
    maxScore: totalMax,
    percentage,
    isPassed,
    submittedAt: new Date(),
    timeTakenSec,
  }).where(eq(quizAttempts.id, attemptId));

  // Jika lulus → tandai lesson selesai
  if (isPassed) {
    await db.insert(lessonProgress).values({
      userId: payload.id,
      lessonId: ctx.lesson.id,
      courseId: ctx.course.id,
      isCompleted: true,
      completedAt: new Date(),
      lastAccessAt: new Date(),
    }).onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { isCompleted: true, completedAt: new Date(), lastAccessAt: new Date() },
    });
    await recalculateProgress(payload.id, ctx.course.id);
  }

  // Email hasil quiz (hanya jika submitter adalah pemilik attempt)
  if (attempt.userId === payload.id) {
    void sendQuizResult(payload.email, payload.name, ctx.course.title, Math.round(percentage), isPassed).catch(
      (e) => console.error('[email] quiz:', e)
    );
  }

  const result = await buildResult(attemptId, ctx.quiz);
  return c.json({ message: 'Jawaban disubmit', ...result }, 200);
});

async function buildResult(attemptId: string, quiz: any) {
  const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).limit(1);
  const answers = await db.select().from(quizAnswers).where(eq(quizAnswers.attemptId, attemptId));
  const questions = await getQuestionsWithAnswers(quiz.id);

  return {
    attempt: { ...attempt },
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage,
    isPassed: attempt.isPassed,
    passingScore: quiz.passingScore,
    answers: answers.map((a) => {
      const q = questions.find((qq) => qq.id === a.questionId);
      return {
        questionId: a.questionId,
        questionText: q?.questionText,
        type: q?.type,
        explanation: q?.explanation,
        options: q?.options,
        selectedOptionIds: a.selectedOptionIds,
        textAnswer: a.textAnswer,
        isCorrect: a.isCorrect,
        pointsEarned: a.pointsEarned,
      };
    }),
  };
}

// ============================================================
// GET /attempts/:attemptId/result — Hasil quiz
// ============================================================
const getResultRoute = createRoute({
  method: 'get',
  path: '/attempts/{attemptId}/result',
  middleware: [authMiddleware],
  request: { params: z.object({ attemptId: z.string().uuid() }) },
  responses: { 200: { description: 'Result', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

quizRoutes.openapi(getResultRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { attemptId } = c.req.valid('param');

  const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).limit(1);
  if (!attempt) return c.json({ error: 'Attempt tidak ditemukan' }, 404);

  const ctx = await getQuizContext(attempt.quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);

  const isOwner = attempt.userId === payload.id;
  const isTeacher = canManage(ctx.course, payload);
  if (!isOwner && !isTeacher) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  return c.json(await buildResult(attemptId, ctx.quiz), 200);
});

// ============================================================
// GET /:quizId/my-attempts — Riwayat attempt sendiri (enrolled)
// ============================================================
const myAttemptsRoute = createRoute({
  method: 'get',
  path: '/{quizId}/my-attempts',
  middleware: [authMiddleware],
  request: { params: z.object({ quizId: z.string().uuid() }) },
  responses: { 200: { description: 'My attempts', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

quizRoutes.openapi(myAttemptsRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { quizId } = c.req.valid('param');

  const ctx = await getQuizContext(quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);

  const hasAccess = canManage(ctx.course, payload) || (await isEnrolled(payload.id, ctx.course.id));
  if (!hasAccess) return c.json({ error: 'Anda harus enrolled untuk mengakses quiz ini' }, 403);

  const attempts = await db.select().from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, payload.id)))
    .orderBy(desc(quizAttempts.attemptNumber));

  return c.json({ attempts }, 200);
});

// ============================================================
// GET /:quizId/attempts — Semua attempt semua student (teacher/admin)
// ============================================================
const allAttemptsRoute = createRoute({
  method: 'get',
  path: '/{quizId}/attempts',
  middleware: [authMiddleware],
  request: { params: z.object({ quizId: z.string().uuid() }) },
  responses: { 200: { description: 'All attempts', content: { 'application/json': { schema: z.any() } } }, 403: { description: 'Forbidden' }, 404: { description: 'Not Found' } },
});

quizRoutes.openapi(allAttemptsRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const { quizId } = c.req.valid('param');

  const ctx = await getQuizContext(quizId);
  if (!ctx) return c.json({ error: 'Quiz tidak ditemukan' }, 404);
  if (!canManage(ctx.course, payload)) return c.json({ error: 'Anda tidak memiliki akses' }, 403);

  const attempts = await db.select({
    id: quizAttempts.id,
    userId: quizAttempts.userId,
    attemptNumber: quizAttempts.attemptNumber,
    score: quizAttempts.score,
    maxScore: quizAttempts.maxScore,
    percentage: quizAttempts.percentage,
    isPassed: quizAttempts.isPassed,
    startedAt: quizAttempts.startedAt,
    submittedAt: quizAttempts.submittedAt,
    timeTakenSec: quizAttempts.timeTakenSec,
    userName: users.name,
    userEmail: users.email,
  })
    .from(quizAttempts)
    .innerJoin(users, eq(quizAttempts.userId, users.id))
    .where(eq(quizAttempts.quizId, quizId))
    .orderBy(desc(quizAttempts.startedAt));

  return c.json({ attempts }, 200);
});

export default quizRoutes;
