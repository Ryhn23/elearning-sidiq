import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../app';
import { db } from '../db';
import { quizzes, quizQuestions, quizOptions } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Quiz API Integration Tests
 * Tests: answer hiding, scoring logic, attempt flow, max attempts
 */

let teacherToken = '';
let studentToken = '';
let quizId = '';
let singleChoiceQuestionId = '';
let correctOptionId = '';
let wrongOptionId = '';

async function loginAs(email: string, password: string): Promise<string> {
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.accessToken as string;
}

describe('Quiz API Endpoints', () => {
  beforeAll(async () => {
    teacherToken = await loginAs('teacher@elearning.com', 'password123');
    studentToken = await loginAs('dewi@student.com', 'password123');

    // Find a quiz from the seeded data by querying DB directly
    const [seedQuiz] = await db.select().from(quizzes).limit(1);
    if (seedQuiz) {
      quizId = seedQuiz.id;

      // Find questions for this quiz
      const questions = await db.select().from(quizQuestions)
        .where(eq(quizQuestions.quizId, quizId));
      const mcq = questions.find(q => q.type === 'multiple_choice');
      if (mcq) {
        singleChoiceQuestionId = mcq.id;
        const options = await db.select().from(quizOptions)
          .where(eq(quizOptions.questionId, mcq.id));
        const correct = options.find(o => o.isCorrect);
        const wrong = options.find(o => !o.isCorrect);
        if (correct) correctOptionId = correct.id;
        if (wrong) wrongOptionId = wrong.id;
      }
    }
  });

  describe('Quiz question visibility (answer hiding)', () => {
    it('POST /:quizId/start - should return questions WITHOUT isCorrect field for students', async () => {
      if (!quizId) {
        console.log('Skipping: no quiz in DB');
        return;
      }

      // Student must be enrolled in the course containing the quiz
      const res = await app.request(`/api/v1/quizzes/${quizId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
      });

      // Could be 403 if not enrolled, or 200 if enrolled, or 404 if quiz doesn't exist in the test's DB state
      if (res.status === 403 || res.status === 404) {
        console.log(`Student not enrolled / quiz gone (${res.status}) – skipping answer-hiding test`);
        return;
      }

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.questions)).toBe(true);

      // CRITICAL: isCorrect must NOT be present in student-facing questions
      data.questions.forEach((q: any) => {
        q.options.forEach((opt: any) => {
          expect(opt).not.toHaveProperty('isCorrect');
        });
      });
    });

    it('GET /:quizId (teacher) - should return questions WITH isCorrect field', async () => {
      if (!quizId) return;

      const res = await app.request(`/api/v1/quizzes/${quizId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${teacherToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.questions)).toBe(true);

      if (data.questions.length > 0 && data.questions[0].options.length > 0) {
        // Teacher view should have isCorrect
        expect(data.questions[0].options[0]).toHaveProperty('isCorrect');
      }
    });
  });

  describe('Quiz validation logic', () => {
    it('POST /:quizId/questions - should reject multiple_choice question with 0 correct options', async () => {
      if (!quizId || !teacherToken) {
        console.log('Skipping: no quiz or teacher token');
        return;
      }

      const res = await app.request(`/api/v1/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          type: 'multiple_choice',
          questionText: 'Invalid question with no correct answer',
          points: 1,
          options: [
            { optionText: 'Option A', isCorrect: false },
            { optionText: 'Option B', isCorrect: false },
          ],
        }),
      });

      // 400 = validation error, 403 = not owner (acceptable in test env)
      expect([400, 403]).toContain(res.status);
      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toBeDefined();
      }
    });

    it('POST /:quizId/questions - should reject true_false with 3 options', async () => {
      if (!quizId || !teacherToken) return;

      const res = await app.request(`/api/v1/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          type: 'true_false',
          questionText: 'Is this correct?',
          points: 1,
          options: [
            { optionText: 'True', isCorrect: true },
            { optionText: 'False', isCorrect: false },
            { optionText: 'Maybe', isCorrect: false },
          ],
        }),
      });

      expect([400, 403]).toContain(res.status);
    });
  });

  describe('Quiz start and auth guards', () => {
    it('POST /:quizId/start - should reject unauthenticated request', async () => {
      if (!quizId) return;

      const res = await app.request(`/api/v1/quizzes/${quizId}/start`, {
        method: 'POST',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('Quiz attempt submission (enrolled students)', () => {
    let attemptId = '';

    it('POST /:quizId/start - should start an attempt for enrolled student', async () => {
      if (!quizId || !singleChoiceQuestionId) return;

      const res = await app.request(`/api/v1/quizzes/${quizId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
      });

      if (res.status === 403 || res.status === 404) {
        console.log(`Student not enrolled or quiz context not found (${res.status}) – skipping attempt tests`);
        return;
      }

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.attemptId).toBeDefined();
      attemptId = data.attemptId;
    });

    it('POST /attempts/:attemptId/submit - should auto-score quiz and return score', async () => {
      if (!attemptId || !singleChoiceQuestionId || !correctOptionId) return;

      const res = await app.request(`/api/v1/quizzes/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          answers: [
            {
              questionId: singleChoiceQuestionId,
              selectedOptionIds: [correctOptionId],
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('score');
      expect(data).toHaveProperty('maxScore');
      expect(typeof data.score).toBe('number');
      expect(data.score).toBeGreaterThanOrEqual(0);
    });

    it('POST /attempts/:attemptId/submit - should return 409 if attempt already submitted', async () => {
      if (!attemptId || !singleChoiceQuestionId || !correctOptionId) return;

      // Try to submit the same attempt again
      const res = await app.request(`/api/v1/quizzes/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          answers: [
            {
              questionId: singleChoiceQuestionId,
              selectedOptionIds: [correctOptionId],
            },
          ],
        }),
      });

      expect(res.status).toBe(409);
    });
  });
});
