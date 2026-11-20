import crypto from 'crypto';
import { db } from '../db';
import { users, sidiqSyncQueue } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const SIDIQ_API_URL = process.env.SIDIQ_API_URL || 'https://hono-backend-staging.nextray.workers.dev';
const SIDIQ_SYNC_SECRET = process.env.SIDIQ_SYNC_SECRET || 'default-elearning-secret-key-change-me';

/**
 * Generate HMAC-SHA256 signature for server-to-server webhook
 */
export function generateHmacSignature(secret: string, timestamp: number, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/**
 * Build headers for secure SIDIQ webhook call
 */
export function buildS2SHeaders(eventId: string, body: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateHmacSignature(SIDIQ_SYNC_SECRET, timestamp, body);
  return {
    'Content-Type': 'application/json',
    'X-Sidiq-Timestamp': String(timestamp),
    'X-Sidiq-Event-ID': eventId,
    'X-Sidiq-Signature': `sha256=${signature}`,
    'X-Sidiq-Secret': SIDIQ_SYNC_SECRET,
  };
}

/**
 * Verify SSO launch ticket against SIDIQ backend
 */
export async function verifySsoTicket(ticket: string): Promise<{
  success: boolean;
  user?: {
    sidiqUserId: string;
    sidiqEntityId: string | null;
    email: string;
    name: string;
    role: 'student' | 'teacher' | 'admin';
    nisNip: string;
    avatarUrl?: string | null;
  };
  error?: string;
}> {
  try {
    const bodyStr = JSON.stringify({ ticket });
    const res = await fetch(`${SIDIQ_API_URL}/api/v1/integrations/elearning/sso/verify`, {
      method: 'POST',
      headers: buildS2SHeaders(`sso_${ticket}`, bodyStr),
      body: bodyStr,
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Gagal memverifikasi tiket SSO' };
    }

    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Koneksi ke SIDIQ gagal' };
  }
}

/**
 * Enqueue grade sync event into Outbox queue
 */
export async function enqueueGradeSync(payload: {
  santriId: string;
  courseId: string;
  courseTitle: string;
  courseSlug?: string;
  pelajaranId?: string;
  quizAverage?: number | null;
  assignmentAverage?: number | null;
  finalGrade?: number | null;
  letterGrade?: string | null;
  progressPercent: number;
  status: string;
  completedAt?: string | null;
}) {
  const eventId = `grade_${payload.santriId}_${payload.courseId}_${Date.now()}`;
  const fullPayload = { ...payload, eventId };

  await db.insert(sidiqSyncQueue).values({
    eventType: 'grades',
    eventId,
    payload: JSON.stringify(fullPayload),
    status: 'pending',
  });

  // Fire and forget immediate attempt
  void processSyncQueue().catch((e) => console.error('[sidiqSync] dispatch error:', e));
}

/**
 * Enqueue certificate event into Outbox queue
 */
export async function enqueueCertificateSync(payload: {
  santriId: string;
  courseId: string;
  courseTitle: string;
  certificateCode: string;
  pdfUrl: string;
  issuedAt: string;
}) {
  const eventId = `cert_${payload.certificateCode}_${Date.now()}`;
  const fullPayload = { ...payload, eventId };

  await db.insert(sidiqSyncQueue).values({
    eventType: 'certificates',
    eventId,
    payload: JSON.stringify(fullPayload),
    status: 'pending',
  });

  void processSyncQueue().catch((e) => console.error('[sidiqSync] dispatch error:', e));
}

/**
 * Process pending Outbox queue events to SIDIQ
 */
export async function processSyncQueue(): Promise<{ processed: number; failed: number }> {
  const pendingRows = await db
    .select()
    .from(sidiqSyncQueue)
    .where(eq(sidiqSyncQueue.status, 'pending'))
    .limit(20);

  let processed = 0;
  let failed = 0;

  for (const row of pendingRows) {
    const endpoint =
      row.eventType === 'certificates'
        ? `${SIDIQ_API_URL}/api/v1/integrations/elearning/webhook/certificates`
        : `${SIDIQ_API_URL}/api/v1/integrations/elearning/webhook/grades`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: buildS2SHeaders(row.eventId, row.payload),
        body: row.payload,
      });

      const resJson = (await res.json()) as any;
      if (res.ok && resJson.success) {
        await db
          .update(sidiqSyncQueue)
          .set({ status: 'success', updatedAt: new Date() })
          .where(eq(sidiqSyncQueue.id, row.id));
        processed++;
      } else {
        await db
          .update(sidiqSyncQueue)
          .set({
            attempts: row.attempts + 1,
            lastError: resJson.error || `HTTP ${res.status}`,
            status: row.attempts >= 5 ? 'failed' : 'pending',
            updatedAt: new Date(),
          })
          .where(eq(sidiqSyncQueue.id, row.id));
        failed++;
      }
    } catch (err: any) {
      await db
        .update(sidiqSyncQueue)
        .set({
          attempts: row.attempts + 1,
          lastError: err.message,
          status: row.attempts >= 5 ? 'failed' : 'pending',
          updatedAt: new Date(),
        })
        .where(eq(sidiqSyncQueue.id, row.id));
      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Pull directory of active students & teachers from SIDIQ
 */
export async function pullDirectoryFromSidiq(): Promise<{
  success: boolean;
  syncedStudents: number;
  syncedTeachers: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${SIDIQ_API_URL}/api/v1/integrations/elearning/directory/users`, {
      method: 'GET',
      headers: buildS2SHeaders('dir_pull', ''),
    });

    const json = (await res.json()) as any;
    if (!res.ok || !json.success || !json.data) {
      return { success: false, syncedStudents: 0, syncedTeachers: 0, error: json.error || 'Failed to pull directory' };
    }

    const { students = [], teachers = [] } = json.data;
    let syncedStudents = 0;
    let syncedTeachers = 0;

    // Sync Students
    for (const s of students) {
      const email = s.email || `${s.nis || s.sidiqEntityId}@santri.sidiq.local`;
      const [existing] = await db
        .select()
        .from(users)
        .where(s.sidiqUserId ? eq(users.sidiqUserId, s.sidiqUserId) : eq(users.email, email))
        .limit(1);

      if (existing) {
        await db
          .update(users)
          .set({
            name: s.name,
            sidiqUserId: s.sidiqUserId || existing.sidiqUserId,
            sidiqEntityId: s.sidiqEntityId,
            sidiqRole: 'student',
            nisNip: s.nisNip,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));
      } else {
        await db.insert(users).values({
          name: s.name,
          email,
          role: 'student',
          sidiqUserId: s.sidiqUserId,
          sidiqEntityId: s.sidiqEntityId,
          sidiqRole: 'student',
          nisNip: s.nisNip,
        });
      }
      syncedStudents++;
    }

    // Sync Teachers
    for (const t of teachers) {
      const email = t.email || `${t.nip || t.sidiqEntityId}@guru.sidiq.local`;
      const [existing] = await db
        .select()
        .from(users)
        .where(t.sidiqUserId ? eq(users.sidiqUserId, t.sidiqUserId) : eq(users.email, email))
        .limit(1);

      if (existing) {
        await db
          .update(users)
          .set({
            name: t.name,
            role: 'teacher',
            sidiqUserId: t.sidiqUserId || existing.sidiqUserId,
            sidiqEntityId: t.sidiqEntityId,
            sidiqRole: 'teacher',
            nisNip: t.nisNip,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));
      } else {
        await db.insert(users).values({
          name: t.name,
          email,
          role: 'teacher',
          sidiqUserId: t.sidiqUserId,
          sidiqEntityId: t.sidiqEntityId,
          sidiqRole: 'teacher',
          nisNip: t.nisNip,
        });
      }
      syncedTeachers++;
    }

    return { success: true, syncedStudents, syncedTeachers };
  } catch (err: any) {
    return { success: false, syncedStudents: 0, syncedTeachers: 0, error: err.message };
  }
}

/**
 * Pull directory of active mata pelajaran from SIDIQ
 */
export async function pullPelajaranFromSidiq(): Promise<{
  success: boolean;
  data?: Array<{ id: string; namaPelajaran: string; kodePelajaran?: string; kategori?: string }>;
  error?: string;
}> {
  try {
    const res = await fetch(`${SIDIQ_API_URL}/api/v1/integrations/elearning/directory/pelajaran`, {
      method: 'GET',
      headers: buildS2SHeaders('mapel_pull', ''),
    });
    const json = (await res.json()) as any;
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Failed to pull mapel' };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
