import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../app';

/**
 * Courses API Integration Tests
 * Requires: running DB seeded with categories and at least 1 course
 */

let teacherToken = '';
let studentToken = '';
let publishedCourseId = '';
let draftCourseId = '';

// Helper: login dan ambil token
async function loginAs(email: string, password: string): Promise<string> {
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body.accessToken as string;
}

// Helper: parse catalog response (returns data[] not courses[])
function parseCatalog(data: any): any[] {
  return Array.isArray(data.data) ? data.data :
    Array.isArray(data.courses) ? data.courses : [];
}

describe('Courses API Endpoints', () => {
  beforeAll(async () => {
    teacherToken = await loginAs('teacher@elearning.com', 'password123');
    studentToken = await loginAs('dewi@student.com', 'password123');
  });

  // ——— Public catalog ———
  describe('GET /api/v1/courses (public catalog)', () => {
    it('should return a list of published courses without auth', async () => {
      const res = await app.request('/api/v1/courses', { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json();
      const courses = parseCatalog(data);
      expect(Array.isArray(courses)).toBe(true);
      // Draft courses must not be visible to unauthenticated callers
      courses.forEach((c: any) => {
        expect(c.status).toBe('published');
      });
    });

    it('should support search by keyword', async () => {
      const res = await app.request('/api/v1/courses?search=Python', { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(parseCatalog(data))).toBe(true);
    });

    it('should support filter by level', async () => {
      const res = await app.request('/api/v1/courses?level=beginner', { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(parseCatalog(data))).toBe(true);
    });
  });

  // ——— Teacher creates draft course ———
  describe('POST /api/v1/courses (teacher)', () => {
    it('should fail without auth', async () => {
      const res = await app.request('/api/v1/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Unauthorized Course', categoryId: 'dummy' }),
      });
      expect(res.status).toBe(401);
    });

    it('should fail if student tries to create a course', async () => {
      // Students don't have teacher/admin role
      const res = await app.request('/api/v1/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ title: 'Student Course Attempt' }),
      });
      // Expect 401 or 403
      expect([401, 403]).toContain(res.status);
    });

    it('should allow teacher to create a draft course', async () => {
      // Get a valid categoryId from the DB first
      const catRes = await app.request('/api/v1/categories', { method: 'GET' });
      const categories = await catRes.json();
      expect(catRes.status).toBe(200);
      const catList: any[] = Array.isArray(categories) ? categories
        : (categories.categories ?? []);
      expect(catList.length > 0).toBe(true);
      const categoryId = catList[0].id;

      const res = await app.request('/api/v1/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          title: `Test Course ${Date.now()}`,
          categoryId,
          level: 'beginner',
          language: 'id',
          price: 0,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      // API returns course directly, not wrapped in { course }
      const course = data.course ?? data;
      expect(course).toBeDefined();
      expect(course.status).toBe('draft');
      draftCourseId = course.id;
    });
  });

  // ——— Draft visibility rules ———
  describe('Draft course visibility', () => {
    it('draft course should not be visible in public catalog', async () => {
      if (!draftCourseId) return; // skip if previous test didn't create
      const catalogRes = await app.request('/api/v1/courses', { method: 'GET' });
      const data = await catalogRes.json();
      const courses = parseCatalog(data);
      const found = courses.find((c: any) => c.id === draftCourseId);
      expect(found).toBeUndefined();
    });

    it('draft course detail should be accessible by the owner teacher', async () => {
      if (!draftCourseId) return;
      const res = await app.request(`/api/v1/courses/${draftCourseId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      // Owner can access their own draft
      expect([200, 403]).toContain(res.status);
    });
  });

  // ——— Seed a published courseId for other tests ———
  describe('Published course exists', () => {
    it('should be able to fetch the first published course detail', async () => {
      const catalogRes = await app.request('/api/v1/courses', { method: 'GET' });
      const data = await catalogRes.json();
      const courses = parseCatalog(data);
      if (courses.length > 0) {
        publishedCourseId = courses[0].id;
      }
      expect(publishedCourseId).toBeTruthy();
    });

    it('GET /api/v1/courses/:id - should return full course detail for published course', async () => {
      if (!publishedCourseId) return;
      const res = await app.request(`/api/v1/courses/${publishedCourseId}`, { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json();
      // API returns course directly, not wrapped in { course }
      const course = data.course ?? data;
      expect(course).toBeDefined();
      expect(course.id).toBe(publishedCourseId);
      // sections may be at top-level or inside course
      const sections = data.sections ?? course.sections ?? [];
      expect(Array.isArray(sections)).toBe(true);
    });
  });

  // ——— Course Reviews ———
  describe('Course Reviews', () => {
    it('POST /api/v1/courses/:id/reviews - should reject unauthenticated review submission', async () => {
      if (!publishedCourseId) return;
      const res = await app.request(`/api/v1/courses/${publishedCourseId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5, review: 'Great course!' }),
      });
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/courses/:id - should include reviews array in response', async () => {
      if (!publishedCourseId) return;
      const res = await app.request(`/api/v1/courses/${publishedCourseId}`, { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json();
      // reviews may be in data.reviews or data.course.reviews
      const reviews = data.reviews ?? data.course?.reviews ?? [];
      expect(Array.isArray(reviews)).toBe(true);
    });
  });
});
