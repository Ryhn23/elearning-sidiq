import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../app';

describe('Auth API Endpoints', () => {
  const timestamp = Date.now();
  const testEmail = `test_user_${timestamp}@example.com`;
  const testPassword = 'Password123!';
  let refreshToken = '';
  let accessToken = '';

  it('POST /api/v1/auth/register - should register a new student successfully', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Student',
        email: testEmail,
        password: testPassword,
        role: 'student',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data.message).toBe('Registrasi berhasil');
  });

  it('POST /api/v1/auth/register - should return 409 conflict for duplicate email', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Student',
        email: testEmail,
        password: testPassword,
        role: 'student',
      }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('Email sudah terdaftar');
  });

  it('POST /api/v1/auth/register - should reject invalid payload (short password)', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid User',
        email: `invalid_${timestamp}@example.com`,
        password: '123',
        role: 'student',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/auth/login - should fail with wrong password', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword!',
      }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Email atau password salah');
  });

  it('POST /api/v1/auth/login - should succeed and return access and refresh tokens', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('accessToken');
    expect(data).toHaveProperty('refreshToken');
    expect(data).toHaveProperty('user');
    expect(data.user.email).toBe(testEmail);

    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
  });

  it('GET /api/v1/auth/me - should access protected route with valid token', async () => {
    const res = await app.request('/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.email).toBe(testEmail);
  });

  it('GET /api/v1/users/me/settings - should fetch default user settings', async () => {
    const res = await app.request('/api/v1/users/me/settings', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.settings).toBeDefined();
    expect(data.settings.emailNotifications).toBe(true);
  });

  it('GET /api/v1/auth/me - should reject request without authorization header', async () => {
    const res = await app.request('/api/v1/auth/me', {
      method: 'GET',
    });

    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/refresh - should rotate refresh token and issue new access token', async () => {
    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('accessToken');
    expect(data).toHaveProperty('refreshToken');
    expect(data.refreshToken).not.toBe(refreshToken);

    // Update tokens
    const oldToken = refreshToken;
    refreshToken = data.refreshToken;

    // Test token rotation: old token should now be invalid/revoked
    const reuseRes = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: oldToken,
      }),
    });
    expect(reuseRes.status).toBe(401);
  });
});
