import { serve } from '@hono/node-server';
import 'dotenv/config';
import { app } from './app';
import { ensureUploadDirs } from './services/storage';
import { closeDb } from './db';

/**
 * Validasi environment fail-fast: server produksi tidak boleh start dengan
 * konfigurasi yang jelas-jelas default/lemah.
 */
function validateEnv(): void {
  const problems: string[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  if (!process.env.DATABASE_URL) {
    // Dev: fallback default di db/index.ts. Prod: wajib eksplisit.
    if (isProd) problems.push('DATABASE_URL wajib diset di produksi');
  }

  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    problems.push('JWT_SECRET wajib diset (min. 32 karakter acak)');
  }
  if (!refreshSecret || refreshSecret.length < 32) {
    problems.push('JWT_REFRESH_SECRET wajib diset (min. 32 karakter acak)');
  }
  if (jwtSecret && refreshSecret && jwtSecret === refreshSecret) {
    problems.push('JWT_SECRET dan JWT_REFRESH_SECRET harus berbeda');
  }

  if (problems.length > 0) {
    console.error('[env] Konfigurasi tidak valid:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  if (isProd && !process.env.SMTP_HOST) {
    console.warn('[env] Peringatan: SMTP_HOST belum diset — email hanya di-log (dry-run).');
  }
}

validateEnv();
ensureUploadDirs();

const port = Number(process.env.PORT) || 3000;
const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on port ${info.port}`);
  }
);

// Gagal bind (mis. port sudah dipakai) → pesan jelas, bukan stack trace.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${port} sudah dipakai oleh proses lain. Ubah PORT atau hentikan proses lama.`);
  } else {
    console.error(`[server] Gagal start: ${err.message}`);
  }
  process.exit(1);
});

// Graceful shutdown: selesaikan request yang sedang berjalan, tutup pool DB.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} diterima — graceful shutdown...`);
  const forceTimer = setTimeout(() => {
    console.error('[server] Shutdown paksa (timeout 10s)');
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  try {
    // Tutup koneksi idle (keep-alive) agar close() tidak menggantung.
    const srv = server as unknown as { closeIdleConnections?: () => void };
    srv.closeIdleConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch {
    /* abaikan — tetap lanjut tutup DB */
  }
  try {
    await closeDb();
  } catch {
    /* abaikan */
  }
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
