import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db';
import { users, refreshTokens, sidiqSyncQueue } from '../db/schema';
import { eq, sql, count } from 'drizzle-orm';
import {
  verifySsoTicket,
  pullDirectoryFromSidiq,
  pullPelajaranFromSidiq,
  processSyncQueue,
} from '../services/sidiqClient';
import { authMiddleware, roleMiddleware } from '../middleware/jwt';

const router = new OpenAPIHono();
const SECRET = process.env.JWT_SECRET || 'super-secret-elearning-key';

function signAccessToken(user: any) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    SECRET,
    { expiresIn: '15m' }
  );
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString('hex');
  await db.insert(refreshTokens).values({
    userId,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return token;
}

function publicUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sidiqUserId: user.sidiqUserId,
    sidiqEntityId: user.sidiqEntityId,
    nisNip: user.nisNip,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    phone: user.phone,
    isActive: user.isActive,
  };
}

// ============================================================================
// 1. POST /sso/consume — Tukar tiket SSO SIDIQ dengan JWT E-Learning
// ============================================================================
router.post('/sso/consume', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.ticket) {
    return c.json({ error: 'Parameter ticket wajib diisi' }, 400);
  }

  const result = await verifySsoTicket(body.ticket);
  if (!result.success || !result.user) {
    return c.json({ error: result.error || 'Tiket SSO tidak valid atau sudah kadaluarsa' }, 401);
  }

  const sidiqUser = result.user;
  const email = sidiqUser.email || `${sidiqUser.nisNip || sidiqUser.sidiqEntityId}@sidiq.local`;

  // Cari user berdasarkan sidiqUserId atau email
  let userRow: any = null;
  const [bySidiqId] = await db
    .select()
    .from(users)
    .where(eq(users.sidiqUserId, sidiqUser.sidiqUserId))
    .limit(1);

  if (bySidiqId) {
    userRow = bySidiqId;
  } else {
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    userRow = byEmail;
  }

  if (userRow) {
    // Update profil terbaru
    const [updated] = await db
      .update(users)
      .set({
        name: sidiqUser.name,
        role: sidiqUser.role,
        sidiqUserId: sidiqUser.sidiqUserId,
        sidiqEntityId: sidiqUser.sidiqEntityId,
        sidiqRole: sidiqUser.role,
        nisNip: sidiqUser.nisNip,
        avatarUrl: sidiqUser.avatarUrl || userRow.avatarUrl,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userRow.id))
      .returning();
    userRow = updated;
  } else {
    // Provision akun baru otomatis
    const [inserted] = await db
      .insert(users)
      .values({
        name: sidiqUser.name,
        email,
        role: sidiqUser.role,
        sidiqUserId: sidiqUser.sidiqUserId,
        sidiqEntityId: sidiqUser.sidiqEntityId,
        sidiqRole: sidiqUser.role,
        nisNip: sidiqUser.nisNip,
        avatarUrl: sidiqUser.avatarUrl || null,
        lastLoginAt: new Date(),
      })
      .returning();
    userRow = inserted;
  }

  if (!userRow.isActive) {
    return c.json({ error: 'Akun Anda dinonaktifkan di sistem E-Learning' }, 403);
  }

  const accessToken = signAccessToken(userRow);
  const refreshToken = await issueRefreshToken(userRow.id);

  return c.json({
    accessToken,
    refreshToken,
    user: publicUser(userRow),
  });
});

// ============================================================================
// 2. POST /sync/pull-users — Trigger tarik santri & guru dari SIDIQ (Admin only)
// ============================================================================
router.post('/sync/pull-users', authMiddleware, roleMiddleware(['admin']), async (c) => {
  const result = await pullDirectoryFromSidiq();
  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }
  return c.json({
    message: 'Sinkronisasi direktori SIDIQ berhasil',
    syncedStudents: result.syncedStudents,
    syncedTeachers: result.syncedTeachers,
  });
});

// ============================================================================
// 3. GET /sync/pelajaran — Ambil mapel SIDIQ untuk dropdown di Course Editor
// ============================================================================
router.get('/sync/pelajaran', authMiddleware, async (c) => {
  const result = await pullPelajaranFromSidiq();
  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }
  return c.json({ data: result.data || [] });
});

// ============================================================================
// 4. POST /sync/process-queue — Trigger proses antrean outbox (Admin / Cron)
// ============================================================================
router.post('/sync/process-queue', authMiddleware, roleMiddleware(['admin']), async (c) => {
  const stats = await processSyncQueue();
  return c.json({ success: true, ...stats });
});

// ============================================================================
// 5. GET /status — Status koneksi integrasi SIDIQ
// ============================================================================
router.get('/status', authMiddleware, roleMiddleware(['admin']), async (c) => {
  const [pendingCount] = await db
    .select({ value: count() })
    .from(sidiqSyncQueue)
    .where(eq(sidiqSyncQueue.status, 'pending'));

  const [failedCount] = await db
    .select({ value: count() })
    .from(sidiqSyncQueue)
    .where(eq(sidiqSyncQueue.status, 'failed'));

  return c.json({
    sidiqApiUrl: process.env.SIDIQ_API_URL || 'https://hono-backend-staging.nextray.workers.dev',
    pendingSyncQueue: pendingCount?.value ?? 0,
    failedSyncQueue: failedCount?.value ?? 0,
    status: 'connected',
  });
});

export default router;
