import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../app';

let adminToken = '';
let teacherToken = '';
let studentToken = '';
let courseId = '';

async function loginAs(email: string, password = 'password123'): Promise<string> {
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body.accessToken as string;
}

describe('CSV Exports API Endpoints', () => {
  beforeAll(async () => {
    adminToken = await loginAs('admin@elearning.com');
    teacherToken = await loginAs('teacher@elearning.com');
    studentToken = await loginAs('dewi@student.com');

    // Fetch existing courses to find a valid course ID
    const catRes = await app.request('/api/v1/courses', { method: 'GET' });
    const catData = await catRes.json();
    const courses = Array.isArray(catData.data) ? catData.data : (catData.courses ?? []);
    if (courses.length > 0) {
      courseId = courses[0].id;
    }
  });

  describe('GET /api/v1/users/export', () => {
    it('should return 401 without auth header', async () => {
      const res = await app.request('/api/v1/users/export', { method: 'GET' });
      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin user (student)', async () => {
      const res = await app.request('/api/v1/users/export', {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('should return 403 for non-admin user (teacher)', async () => {
      const res = await app.request('/api/v1/users/export', {
        method: 'GET',
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('should return CSV data with 200 status for admin', async () => {
      const res = await app.request('/api/v1/users/export', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const csvText = await res.text();
      expect(csvText).toContain('ID User');
      expect(csvText).toContain('Nama Lengkap');
      expect(csvText).toContain('Email');
      expect(csvText).toContain('admin@elearning.com');
    });
  });

  describe('GET /api/v1/courses/:id/students/export', () => {
    it('should return 401 without auth header', async () => {
      if (!courseId) return;
      const res = await app.request(`/api/v1/courses/${courseId}/students/export`, { method: 'GET' });
      expect(res.status).toBe(401);
    });

    it('should return 403 for unauthorized student', async () => {
      if (!courseId) return;
      const res = await app.request(`/api/v1/courses/${courseId}/students/export`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('should return CSV students data for admin', async () => {
      if (!courseId) return;
      const res = await app.request(`/api/v1/courses/${courseId}/students/export`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const csvText = await res.text();
      expect(csvText).toContain('ID Siswa');
      expect(csvText).toContain('Nama Siswa');
      expect(csvText).toContain('Email');
      expect(csvText).toContain('Progress (%)');
      expect(csvText).toContain('Status');
    });
  });

  describe('GET /api/v1/courses/:id/gradebook/export', () => {
    it('should return 401 without auth header', async () => {
      if (!courseId) return;
      const res = await app.request(`/api/v1/courses/${courseId}/gradebook/export`, { method: 'GET' });
      expect(res.status).toBe(401);
    });

    it('should return 403 for unauthorized student', async () => {
      if (!courseId) return;
      const res = await app.request(`/api/v1/courses/${courseId}/gradebook/export`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('should return CSV gradebook data for admin', async () => {
      if (!courseId) return;
      const res = await app.request(`/api/v1/courses/${courseId}/gradebook/export`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const csvText = await res.text();
      expect(csvText).toContain('ID Siswa');
      expect(csvText).toContain('Nama Siswa');
      expect(csvText).toContain('Nilai Akhir');
      expect(csvText).toContain('Grade Huruf');
    });
  });
});
