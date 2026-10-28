import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../app';

let adminToken = '';
let teacherToken = '';
let studentToken = '';
let createdUserId = '';
let createdCategoryId = '';
let createdCategorySlug = '';

async function loginAs(email: string, password = 'password123'): Promise<string> {
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body.accessToken as string;
}

describe('Admin Management API (User, Analytics, Category)', () => {
  beforeAll(async () => {
    adminToken = await loginAs('admin@elearning.com');
    teacherToken = await loginAs('teacher@elearning.com');
    studentToken = await loginAs('budi@student.com');
  });

  // ============================================================
  // GET /api/v1/users — Admin-only: list user
  // ============================================================
  describe('GET /api/v1/users', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/v1/users', { method: 'GET' });
      expect(res.status).toBe(401);
    });

    it('should return 403 for student', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('should return 403 for teacher', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'GET',
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('should return 200 with data + pagination for admin', async () => {
      const res = await app.request('/api/v1/users?page=1&limit=10', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // POST /api/v1/users — Admin buat user manual (mentor/guru/student)
  // ============================================================
  describe('POST /api/v1/users', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA User', email: `qa.user.${Date.now()}@test.com`, password: 'password123', role: 'student' }),
      });
      expect(res.status).toBe(401);
    });

    it('should return 403 for teacher', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacherToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA User', email: `qa.user.${Date.now()}@test.com`, password: 'password123', role: 'student' }),
      });
      expect(res.status).toBe(403);
    });

    it('should return 409 for duplicate email', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA User', email: 'admin@elearning.com', password: 'password123', role: 'student' }),
      });
      expect(res.status).toBe(409);
    });

    it('should create a teacher user successfully', async () => {
      const email = `qa.mentor.${Date.now()}@test.com`;
      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA Mentor', email, password: 'password123', role: 'teacher' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.email).toBe(email);
      expect(body.role).toBe('teacher');
      createdUserId = body.id;
    });
  });

  // ============================================================
  // PUT /api/v1/users/:id — Admin edit user
  // ============================================================
  describe('PUT /api/v1/users/:id', () => {
    it('should return 404 for unknown user id', async () => {
      const res = await app.request('/api/v1/users/00000000-0000-4000-8000-000000000000', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA Updated' }),
      });
      expect(res.status).toBe(404);
    });

    it('should update user name', async () => {
      expect(Boolean(createdUserId)).toBe(true);
      const res = await app.request(`/api/v1/users/${createdUserId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA Mentor Updated' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('QA Mentor Updated');
    });
  });

  // ============================================================
  // PATCH /api/v1/users/:id/activate & /deactivate — Admin toggle status
  // ============================================================
  describe('PATCH /api/v1/users/:id/activate & /deactivate', () => {
    it('should deactivate created user (200)', async () => {
      expect(Boolean(createdUserId)).toBe(true);
      const res = await app.request(`/api/v1/users/${createdUserId}/deactivate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
    });

    it('should reactivate created user (200)', async () => {
      const res = await app.request(`/api/v1/users/${createdUserId}/activate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // GET /api/v1/analytics/overview — Admin dashboard
  // ============================================================
  describe('GET /api/v1/analytics/overview', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/v1/analytics/overview');
      expect(res.status).toBe(401);
    });

    it('should return 403 for teacher', async () => {
      const res = await app.request('/api/v1/analytics/overview', {
        method: 'GET',
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('should return 200 overview payload for admin', async () => {
      const res = await app.request('/api/v1/analytics/overview', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totals).toBeDefined();
      expect(body.totals).toHaveProperty('users');
      expect(body.totals).toHaveProperty('teachers');
      expect(body.totals).toHaveProperty('publishedCourses');
      expect(body.totals).toHaveProperty('enrollments');
      expect(body.totals).toHaveProperty('completedEnrollments');
      expect(Array.isArray(body.topCourses)).toBe(true);
      expect(Array.isArray(body.recentEnrollments)).toBe(true);
    });
  });

  // ============================================================
  // Category CRUD (admin)
  // ============================================================
  describe('Category CRUD (admin)', () => {
    it('GET /api/v1/categories — public list', async () => {
      const res = await app.request('/api/v1/categories', { method: 'GET' });
      expect(res.status).toBe(200);
    });

    it('POST /api/v1/categories — admin create', async () => {
      const slug = `qa-cat-${Date.now()}`;
      const res = await app.request('/api/v1/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA Category', slug, description: 'QA category', sortOrder: 99 }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      createdCategoryId = body.id;
      createdCategorySlug = slug;
    });

    it('POST /api/v1/categories — admin duplicate slug returns 409', async () => {
      expect(Boolean(createdCategoryId)).toBe(true);
      const res = await app.request('/api/v1/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA Category', slug: createdCategorySlug, sortOrder: 98 }),
      });
      expect(res.status).toBe(409);
    });

    it('PUT /api/v1/categories/:id — admin update', async () => {
      expect(Boolean(createdCategoryId)).toBe(true);
      const res = await app.request(`/api/v1/categories/${createdCategoryId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA Category Updated' }),
      });
      expect(res.status).toBe(200);
    });

    it('DELETE /api/v1/categories/:id — admin delete', async () => {
      expect(Boolean(createdCategoryId)).toBe(true);
      const res = await app.request(`/api/v1/categories/${createdCategoryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(204);
    });

    it('PUT /api/v1/categories/:id — unknown id returns 404', async () => {
      const res = await app.request('/api/v1/categories/00000000-0000-4000-8000-000000000000', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA Updated' }),
      });
      expect(res.status).toBe(404);
    });
  });
});
