import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { db } from '../db';
import { users, refreshTokens, passwordResetTokens } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/jwt';
import { sendPasswordReset, sendWelcomeEmail, APP_URL } from '../services/email';
import { rateLimit } from '../middleware/rateLimit';

const authRoute = new OpenAPIHono();
const SECRET = process.env.JWT_SECRET || 'super-secret-elearning-key';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-elearning-key';

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

type JwtPayload = { id: string; role: string; email: string; name: string };

function signAccessToken(user: any) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString('hex');
  await db.insert(refreshTokens).values({
    userId,
    token,
    expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
  });
  return token;
}

function publicUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    phone: user.phone,
    googleId: user.googleId,
    isActive: user.isActive,
  };
}

// ============================================================
// POST /register — Daftar akun baru
// ============================================================

const RegisterSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  role: z.enum(['student', 'teacher']).default('student'),
});

const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  middleware: [rateLimit({ limit: 3, windowMs: 60 * 60 * 1000, name: 'register' })],
  request: { body: { content: { 'application/json': { schema: RegisterSchema } } } },
  responses: {
    201: { description: 'Success', content: { 'application/json': { schema: z.object({ message: z.string(), id: z.string() }) } } },
    400: { description: 'Bad Request' },
    409: { description: 'Conflict' },
  },
});

authRoute.openapi(registerRoute, async (c) => {
  const body = c.req.valid('json');

  const existingUser = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  if (existingUser.length > 0) {
    return c.json({ error: 'Email sudah terdaftar' }, 409);
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(body.password, salt);

  const [newUser] = await db.insert(users).values({
    name: body.name,
    email: body.email,
    passwordHash,
    role: body.role as any,
  }).returning({ id: users.id });

  // Email sambutan (fire-and-forget)
  void sendWelcomeEmail(body.email, body.name).catch((e) => console.error('[email] welcome:', e));

  return c.json({ message: 'Registrasi berhasil', id: newUser.id }, 201);
});

// ============================================================
// POST /login — Login manual → accessToken + refreshToken
// ============================================================

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  middleware: [rateLimit({ limit: 5, windowMs: 15 * 60 * 1000, name: 'login' })],
  request: { body: { content: { 'application/json': { schema: LoginSchema } } } },
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: z.any() } } },
    401: { description: 'Unauthorized' },
  },
});

authRoute.openapi(loginRoute, async (c) => {
  const body = c.req.valid('json');

  const userRows = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  const user = userRows[0];
  if (!user || !user.passwordHash) {
    return c.json({ error: 'Email atau password salah' }, 401);
  }

  const isValid = await bcrypt.compare(body.password, user.passwordHash);
  if (!isValid) {
    return c.json({ error: 'Email atau password salah' }, 401);
  }

  if (!user.isActive) {
    return c.json({ error: 'Akun Anda dinonaktifkan. Hubungi admin.' }, 403);
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  return c.json({ accessToken, refreshToken, user: publicUser(user) }, 200);
});

// ============================================================
// POST /refresh — Tukar refresh token → access token baru (rotation)
// ============================================================

const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  request: { body: { content: { 'application/json': { schema: RefreshSchema } } } },
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: z.any() } } },
    401: { description: 'Unauthorized' },
  },
});

authRoute.openapi(refreshRoute, async (c) => {
  const body = c.req.valid('json');

  const [tokenRow] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, body.refreshToken)).limit(1);
  if (!tokenRow) return c.json({ error: 'Refresh token tidak valid' }, 401);

  if (tokenRow.expiresAt < new Date()) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenRow.id));
    return c.json({ error: 'Refresh token expired' }, 401);
  }

  const userRows = await db.select().from(users).where(eq(users.id, tokenRow.userId)).limit(1);
  const user = userRows[0];
  if (!user || !user.isActive) return c.json({ error: 'User tidak ditemukan atau dinonaktifkan' }, 401);

  // Rotation: invalidate token lama, issue baru
  await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenRow.id));
  const newRefreshToken = await issueRefreshToken(user.id);
  const accessToken = signAccessToken(user);

  return c.json({ accessToken, refreshToken: newRefreshToken, user: publicUser(user) }, 200);
});

// ============================================================
// POST /logout — Hapus refresh token (blacklist)
// ============================================================

const LogoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  middleware: [authMiddleware],
  request: { body: { content: { 'application/json': { schema: LogoutSchema } } } },
  responses: { 204: { description: 'Logged out' } },
});

authRoute.openapi(logoutRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const body = c.req.valid('json');

  if (body.refreshToken) {
    await db.delete(refreshTokens).where(and(eq(refreshTokens.userId, payload.id), eq(refreshTokens.token, body.refreshToken)));
  } else {
    // Hapus semua refresh token user (logout dari semua device)
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, payload.id));
  }

  return c.body(null, 204);
});

// ============================================================
// GET /me — Profil user sendiri (dari DB)
// ============================================================

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  middleware: [authMiddleware],
  responses: {
    200: { description: 'Get current user profile', content: { 'application/json': { schema: z.any() } } },
    401: { description: 'Unauthorized' },
    404: { description: 'Not Found' },
  },
});

authRoute.openapi(meRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const [user] = await db.select().from(users).where(eq(users.id, payload.id)).limit(1);
  if (!user) return c.json({ error: 'User tidak ditemukan' }, 404);
  return c.json({ user: publicUser(user) }, 200);
});

// ============================================================
// PUT /me — Update profil (name, bio, phone, avatarUrl)
// ============================================================

const UpdateMeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  bio: z.string().max(2000).optional(),
  phone: z.string().max(20).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

const updateMeRoute = createRoute({
  method: 'put',
  path: '/me',
  middleware: [authMiddleware],
  request: { body: { content: { 'application/json': { schema: UpdateMeSchema } } } },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Not Found' },
  },
});

authRoute.openapi(updateMeRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const body = c.req.valid('json');

  const [user] = await db.update(users).set({ ...body }).where(eq(users.id, payload.id)).returning();
  if (!user) return c.json({ error: 'User tidak ditemukan' }, 404);
  return c.json({ user: publicUser(user) }, 200);
});

// ============================================================
// PUT /me/password — Ganti password (wajib currentPassword)
// ============================================================

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
});

const changePasswordRoute = createRoute({
  method: 'put',
  path: '/me/password',
  middleware: [authMiddleware],
  request: { body: { content: { 'application/json': { schema: ChangePasswordSchema } } } },
  responses: {
    200: { description: 'Password changed' },
    400: { description: 'Bad Request' },
    401: { description: 'Unauthorized' },
    404: { description: 'Not Found' },
  },
});

authRoute.openapi(changePasswordRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const body = c.req.valid('json');

  const [user] = await db.select().from(users).where(eq(users.id, payload.id)).limit(1);
  if (!user) return c.json({ error: 'User tidak ditemukan' }, 404);
  if (!user.passwordHash) return c.json({ error: 'Akun ini tidak memiliki password' }, 400);

  const isValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
  if (!isValid) return c.json({ error: 'Password saat ini salah' }, 401);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(body.newPassword, salt);
  await db.update(users).set({ passwordHash }).where(eq(users.id, payload.id));

  // Invalidate semua refresh token (keamanan)
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, payload.id));

  return c.json({ message: 'Password berhasil diganti' }, 200);
});

// ============================================================
// POST /forgot-password — Request reset password via email
// Selalu 200 (tidak membocorkan apakah email terdaftar)
// ============================================================

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

const forgotPasswordRoute = createRoute({
  method: 'post',
  path: '/forgot-password',
  middleware: [rateLimit({ limit: 3, windowMs: 60 * 60 * 1000, name: 'forgot' })],
  request: { body: { content: { 'application/json': { schema: ForgotPasswordSchema } } } },
  responses: { 200: { description: 'OK' } },
});

authRoute.openapi(forgotPasswordRoute, async (c) => {
  const body = c.req.valid('json');
  const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);

  if (user && user.isActive) {
    // Hapus token lama yang belum terpakai
    await db.delete(passwordResetTokens).where(
      and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt))
    );

    const token = crypto.randomBytes(32).toString('hex');
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 jam
    });
    await sendPasswordReset(user.email, user.name, token);
  }

  return c.json({ message: 'Jika email terdaftar, tautan reset password telah dikirim.' }, 200);
});

// ============================================================
// POST /reset-password — Submit token + password baru
// ============================================================

const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8, 'Password minimal 8 karakter'),
});

const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/reset-password',
  request: { body: { content: { 'application/json': { schema: ResetPasswordSchema } } } },
  responses: {
    200: { description: 'Success' },
    400: { description: 'Token invalid/expired' },
  },
});

authRoute.openapi(resetPasswordRoute, async (c) => {
  const body = c.req.valid('json');

  const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, body.token)).limit(1);
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return c.json({ error: 'Tautan reset tidak valid atau sudah kadaluarsa' }, 400);
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(body.newPassword, salt);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    // Invalidate semua refresh token user
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, row.userId));
  });

  return c.json({ message: 'Password berhasil diubah. Silakan login.' }, 200);
});

// ============================================================
// GOOGLE OAUTH — Bind & Login
// Alur bind: user lokal → POST /me/google/bind → redirect Google →
//   GET /me/google/callback?code&state → simpan google_id → redirect /profile
// Alur login: GET /google/login → redirect Google →
//   GET /google/callback?code&state → cookie sesaat + redirect /auth/google/callback
// ============================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const googleRedirectBind = () => process.env.GOOGLE_REDIRECT_BIND_URL || `${APP_URL}/api/v1/auth/me/google/callback`;
const googleRedirectLogin = () => process.env.GOOGLE_REDIRECT_LOGIN_URL || `${APP_URL}/api/v1/auth/google/callback`;

function googleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function buildGoogleAuthUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
}

async function googleExchangeCode(code: string, redirectUri: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange gagal (${res.status})`);
  return (await res.json()) as { access_token?: string };
}

async function googleUserInfo(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo gagal (${res.status})`);
  return (await res.json()) as { sub?: string; email?: string; name?: string };
}

// POST /me/google/bind — mulai bind, return authUrl
const googleBindRoute = createRoute({
  method: 'post',
  path: '/me/google/bind',
  middleware: [authMiddleware],
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: z.object({ authUrl: z.string() }) } } },
    503: { description: 'Google OAuth belum dikonfigurasi' },
  },
});

authRoute.openapi(googleBindRoute, async (c) => {
  if (!googleConfigured()) return c.json({ error: 'Google OAuth belum dikonfigurasi di server' }, 503);
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  const state = jwt.sign({ userId: payload.id, purpose: 'bind' }, SECRET, { expiresIn: '10m' });
  return c.json({ authUrl: buildGoogleAuthUrl(state, googleRedirectBind()) }, 200);
});

// GET /me/google/callback — callback bind (tanpa auth; identitas dari state JWT)
const googleBindCallbackRoute = createRoute({
  method: 'get',
  path: '/me/google/callback',
  responses: { 302: { description: 'Redirect' }, 400: { description: 'Bad request' } },
});

authRoute.openapi(googleBindCallbackRoute, async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) return c.json({ error: 'Parameter callback tidak lengkap' }, 400);

  let decoded: any;
  try {
    decoded = jwt.verify(state, SECRET);
  } catch {
    return c.redirect(`${APP_URL}/profile?google_bind=error`);
  }
  if (decoded.purpose !== 'bind') return c.redirect(`${APP_URL}/profile?google_bind=error`);

  try {
    const { access_token } = await googleExchangeCode(code, googleRedirectBind());
    if (!access_token) throw new Error('no access token');
    const info = await googleUserInfo(access_token!);
    if (!info.sub) throw new Error('google sub missing');

    await db.update(users)
      .set({ googleId: info.sub, googleEmail: info.email || null })
      .where(eq(users.id, decoded.userId));
  } catch (e) {
    console.error('[google-bind] gagal:', e);
    return c.redirect(`${APP_URL}/profile?google_bind=error`);
  }

  return c.redirect(`${APP_URL}/profile?google_bind=success`);
});

// DELETE /me/google/unbind — lepas bind Google
const googleUnbindRoute = createRoute({
  method: 'delete',
  path: '/me/google/unbind',
  middleware: [authMiddleware],
  responses: { 200: { description: 'OK' } },
});

authRoute.openapi(googleUnbindRoute, async (c) => {
  const payload = c.get('jwtPayload' as never) as JwtPayload;
  await db.update(users).set({ googleId: null, googleEmail: null }).where(eq(users.id, payload.id));
  return c.json({ message: 'Akun Google dilepas' }, 200);
});

// GET /google/login — mulai login via Google, return authUrl
const googleLoginRoute = createRoute({
  method: 'get',
  path: '/google/login',
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: z.object({ authUrl: z.string() }) } } },
    503: { description: 'Google OAuth belum dikonfigurasi' },
  },
});

authRoute.openapi(googleLoginRoute, async (c) => {
  if (!googleConfigured()) return c.json({ error: 'Google OAuth belum dikonfigurasi di server' }, 503);
  const state = jwt.sign({ purpose: 'login' }, SECRET, { expiresIn: '10m' });
  return c.json({ authUrl: buildGoogleAuthUrl(state, googleRedirectLogin()) }, 200);
});

// GET /google/callback — callback login → cookie sesaat + redirect frontend handler
const googleCallbackRoute = createRoute({
  method: 'get',
  path: '/google/callback',
  responses: { 302: { description: 'Redirect' }, 400: { description: 'Bad request' } },
});

authRoute.openapi(googleCallbackRoute, async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) return c.json({ error: 'Parameter callback tidak lengkap' }, 400);

  let decoded: any;
  try {
    decoded = jwt.verify(state, SECRET);
  } catch {
    return c.redirect(`${APP_URL}/login?error=google_state_invalid`);
  }
  if (decoded.purpose !== 'login') return c.redirect(`${APP_URL}/login?error=google_state_invalid`);

  try {
    const { access_token } = await googleExchangeCode(code, googleRedirectLogin());
    if (!access_token) throw new Error('no access token');
    const info = await googleUserInfo(access_token!);
    if (!info.sub) throw new Error('google sub missing');

    const [user] = await db.select().from(users).where(eq(users.googleId, info.sub)).limit(1);
    if (!user || !user.isActive) {
      // Akun Google belum di-bind → arahkan ke login manual
      return c.redirect(`${APP_URL}/login?error=google_not_bound`);
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);
    const cookiePayload = encodeURIComponent(JSON.stringify({ at: accessToken, rt: refreshToken }));
    c.header(
      'Set-Cookie',
      `el_google_auth=${cookiePayload}; Path=/; Max-Age=600; SameSite=Lax`
    );
    return c.redirect(`${APP_URL}/auth/google/callback`);
  } catch (e) {
    console.error('[google-login] gagal:', e);
    return c.redirect(`${APP_URL}/login?error=google_failed`);
  }
});

export default authRoute;
