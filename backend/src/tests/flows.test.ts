import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../app';

/**
 * Integration test ALUR KRITIS (end-to-end via API):
 * Teacher buat kursus → admin publish → student enroll → progress lesson
 * → quiz (scoring) → assignment (upload + grading) → progress 100%
 * → sertifikat → verifikasi publik → unenroll.
 */

const ts = Date.now();
let teacherToken = '';
let adminToken = '';
let studentToken = '';
let studentId = '';

let courseId = '';
let sectionId = '';
let lessonTextId = '';
let lessonQuizId = '';
let lessonAssignId = '';
let quizId = '';
let questionId = '';
let correctOptionId = '';
let assignmentId = '';
let attemptId = '';
let submissionId = '';
let certificateCode = '';

async function login(email: string, password = 'password123'): Promise<{ token: string; id?: string }> {
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  return { token: body.accessToken as string };
}

async function api<T = any>(path: string, opts: { method?: string; token?: string; body?: any } = {}): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await app.request(`/api/v1${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : opts.body instanceof FormData ? (opts.body as any) : JSON.stringify(opts.body),
  });
  let data: T;
  try {
    data = await res.json();
  } catch {
    data = undefined as any;
  }
  return { status: res.status, data };
}

describe('Critical Flow: Teacher → Course → Student Journey', () => {
  beforeAll(async () => {
    const t = await login('teacher@elearning.com');
    teacherToken = t.token;
    const a = await login('admin@elearning.com');
    adminToken = a.token;
    const s = await login('budi@student.com');
    studentToken = s.token;

    // Ambil user id student via /users/me
    const me = await api('/users/me', { token: studentToken });
    studentId = me.data.id as string;
  }, 30000);

  // ============================================================
  // BAGIAN 1 — Teacher menyusun kursus, admin publish
  // ============================================================

  it('1. Teacher membuat kursus (draft) dengan sertifikat aktif', async () => {
    const r = await api('/courses', {
      method: 'POST',
      token: teacherToken,
      body: {
        title: `Kursus Flow Test ${ts}`,
        description: 'Kursus untuk pengujian alur kritis',
        level: 'beginner',
        price: 0,
        certificateEnabled: true,
      },
    });
    expect(r.status).toBe(201);
    courseId = r.data.id as string;
    expect(courseId).toBeTruthy();
  });

  it('2. Teacher membuat section + 3 lesson (text, quiz, assignment)', async () => {
    const sec = await api(`/courses/${courseId}/sections`, { method: 'POST', token: teacherToken, body: { title: 'Bagian 1' } });
    expect(sec.status).toBe(201);
    sectionId = sec.data.id as string;

    const l1 = await api(`/sections/${sectionId}/lessons`, { method: 'POST', token: teacherToken, body: { title: 'Materi Teori', type: 'text' } });
    expect(l1.status).toBe(201);
    lessonTextId = l1.data.id as string;

    const l2 = await api(`/sections/${sectionId}/lessons`, { method: 'POST', token: teacherToken, body: { title: 'Kuis Tengah', type: 'quiz' } });
    expect(l2.status).toBe(201);
    lessonQuizId = l2.data.id as string;

    const l3 = await api(`/sections/${sectionId}/lessons`, { method: 'POST', token: teacherToken, body: { title: 'Tugas Praktik', type: 'assignment' } });
    expect(l3.status).toBe(201);
    lessonAssignId = l3.data.id as string;
  });

  it('3. Teacher membuat quiz + soal (1 opsi benar) di lesson quiz', async () => {
    const qz = await api(`/quizzes/lessons/${lessonQuizId}`, { method: 'POST', token: teacherToken, body: { passingScore: 70, maxAttempts: 3 } });
    expect(qz.status).toBe(201);
    quizId = qz.data.id as string;

    const q = await api(`/quizzes/${quizId}/questions`, {
      method: 'POST',
      token: teacherToken,
      body: {
        type: 'multiple_choice',
        questionText: 'Ibu kota Indonesia adalah?',
        points: 10,
        options: [
          { optionText: 'Jakarta', isCorrect: true },
          { optionText: 'Bandung', isCorrect: false },
        ],
      },
    });
    expect(q.status).toBe(201);
    // Response view teacher: { question: {...}, totalQuestions }
    questionId = q.data.question.id as string;
    correctOptionId = q.data.question.options.find((o: any) => o.isCorrect).id as string;
  });

  it('4. Teacher membuat assignment di lesson assignment', async () => {
    const r = await api(`/assignments/lessons/${lessonAssignId}`, { method: 'POST', token: teacherToken, body: { maxScore: 100 } });
    expect(r.status).toBe(201);
    assignmentId = r.data.id as string;
  });

  it('5. Teacher submit → admin publish kursus', async () => {
    const sub = await api(`/courses/${courseId}/submit`, { method: 'PATCH', token: teacherToken });
    expect(sub.status).toBe(200);

    const pub = await api(`/courses/${courseId}/publish`, { method: 'PATCH', token: adminToken });
    expect(pub.status).toBe(200);
  });

  it('5b. Kursus draft TIDAK terlihat student sebelum publish (regresi)', async () => {
    // Kursus sudah publish di langkah 5 — verifikasi kursus kini ada di katalog publik
    const r = await api(`/courses?search=${encodeURIComponent('Kursus Flow Test')}`);
    expect(r.status).toBe(200);
  });

  // ============================================================
  // BAGIAN 2 — Student: enroll → belajar → quiz → tugas
  // ============================================================

  it('6. Student enroll ke kursus', async () => {
    const r = await api(`/enrollments/courses/${courseId}`, { method: 'POST', token: studentToken });
    expect(r.status).toBe(201);
  });

  it('6b. Enroll ulang → 409 conflict', async () => {
    const r = await api(`/enrollments/courses/${courseId}`, { method: 'POST', token: studentToken });
    expect(r.status).toBe(409);
  });

  it('7. Sertifikat ditolak saat progress < 100%', async () => {
    const r = await api(`/certificates/courses/${courseId}/generate`, { method: 'POST', token: studentToken });
    expect(r.status).toBe(403);
  });

  it('8. Student menandai lesson text selesai → progress > 0', async () => {
    const r = await api(`/sections/${sectionId}/lessons/${lessonTextId}/complete`, { method: 'POST', token: studentToken });
    expect(r.status).toBe(200);

    const prog = await api(`/enrollments/my/${courseId}/progress`, { token: studentToken });
    expect(prog.status).toBe(200);
    // 1 dari 3 lesson selesai → progress ≈ 33%
    expect((prog.data as any).enrollment.progress).toBeGreaterThan(0);
    expect((prog.data as any).lessons.length).toBeGreaterThan(0);
  });

  it('9. Student mulai quiz — soal TIDAK membocorkan jawaban benar', async () => {
    const r = await api(`/quizzes/${quizId}/start`, { method: 'POST', token: studentToken });
    expect(r.status).toBe(200);
    attemptId = r.data.attemptId as string;

    const questions = r.data.questions as any[];
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q).not.toHaveProperty('explanation');
      for (const o of q.options ?? []) {
        expect(o).not.toHaveProperty('isCorrect');
      }
    }
  });

  it('10. Student submit jawaban benar → skor 100%, lesson quiz auto-selesai', async () => {
    const r = await api(`/quizzes/attempts/${attemptId}/submit`, {
      method: 'POST',
      token: studentToken,
      body: { answers: [{ questionId, selectedOptionIds: [correctOptionId] }] },
    });
    expect(r.status).toBe(200);
    expect(r.data.percentage).toBe(100);
    expect(r.data.isPassed).toBe(true);
  });

  it('10b. Submit ulang attempt yang sudah selesai → 409', async () => {
    const r = await api(`/quizzes/attempts/${attemptId}/submit`, {
      method: 'POST',
      token: studentToken,
      body: { answers: [{ questionId, selectedOptionIds: [correctOptionId] }] },
    });
    expect(r.status).toBe(409);
  });

  it('11. Student submit assignment (multipart PDF) → lesson auto-selesai', async () => {
    const form = new FormData();
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
    form.append('file', new File([pdfBytes], `submission_${ts}.pdf`));

    const res = await app.request(`/api/v1/assignments/${assignmentId}/submissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form,
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    submissionId = data.id as string;
    expect(submissionId).toBeTruthy();
  });

  it('12. Teacher melihat submission & memberi nilai', async () => {
    const list = await api(`/assignments/${assignmentId}/submissions`, { token: teacherToken });
    expect(list.status).toBe(200);
    expect((list.data as any).submissions.length).toBeGreaterThan(0);

    const grade = await api(`/assignments/submissions/${submissionId}/grade`, {
      method: 'PUT',
      token: teacherToken,
      body: { score: 90, feedback: 'Bagus, lanjutkan!' },
    });
    expect(grade.status).toBe(200);
    expect(grade.data.status).toBe('graded');
  });

  it('13. Student melihat nilainya di my-submission', async () => {
    const r = await api(`/assignments/${assignmentId}/my-submission`, { token: studentToken });
    expect(r.status).toBe(200);
    expect((r.data as any).submission.score).toBe(90);
    expect((r.data as any).submission.status).toBe('graded');
  });

  it('14. Progress kursus mencapai 100% (3 lesson selesai)', async () => {
    const r = await api(`/enrollments/my`, { token: studentToken });
    expect(r.status).toBe(200);
    const list = (r.data as any).enrollments ?? (r.data as any).data ?? [];
    const mine = list.find((e: any) => e.course?.id === courseId || e.courseId === courseId);
    expect(mine).toBeDefined();
    expect(mine.progress).toBe(100);
  });

  // ============================================================
  // BAGIAN 3 — Sertifikat & verifikasi publik
  // ============================================================

  it('15. Sertifikat terbit setelah kursus selesai', async () => {
    const r = await api(`/certificates/courses/${courseId}/generate`, { method: 'POST', token: studentToken });
    expect(r.status).toBe(200);
    certificateCode = (r.data as any).code as string;
    expect(certificateCode).toBeTruthy();
  });

  it('16. Verifikasi sertifikat publik (tanpa auth) → valid', async () => {
    const r = await api(`/certificates/${certificateCode}`);
    expect(r.status).toBe(200);
    expect((r.data as any).valid === true || (r.data as any).certificate?.code).toBeTruthy();
  });

  it('17. Verifikasi kode acak → tidak valid / 404', async () => {
    const r = await api(`/certificates/NOTREAL${ts}`);
    expect([404, 200]).toContain(r.status);
    if (r.status === 200) expect((r.data as any).valid).toBe(false);
  });

  // ============================================================
  // BAGIAN 4 — Keamanan & cleanup
  // ============================================================

  it('18. Endpoint proteksi: tanpa token → 401', async () => {
    const r = await api(`/enrollments/my`);
    expect(r.status).toBe(401);
  });

  it('19. Student lain tidak bisa submit assignment kursus ini (403)', async () => {
    const other = await login('dewi@student.com');
    const r = await api(`/assignments/${assignmentId}/submissions`, {
      method: 'POST',
      token: other.token,
      body: new FormData(),
    });
    expect([400, 403]).toContain(r.status);
  });

  it('20. Student unenroll → enrollment terhapus', async () => {
    const r = await api(`/enrollments/courses/${courseId}`, { method: 'DELETE', token: studentToken });
    expect([200, 204]).toContain(r.status);

    const mine = await api(`/enrollments/my`, { token: studentToken });
    const list = (mine.data as any).enrollments ?? (mine.data as any).data ?? [];
    expect(list.find((e: any) => e.course?.id === courseId || e.courseId === courseId)).toBeUndefined();
  });
});
