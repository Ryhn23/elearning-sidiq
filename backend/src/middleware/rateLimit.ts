import type { Context } from 'hono';
import Redis from 'ioredis';

/**
 * Rate limiting middleware (per IP).
 * - Jika REDIS_URL diset → counter di Redis (survive restart, multi-instance)
 * - Fallback: in-memory Map (dev / single-server tanpa Redis)
 */

const REDIS_URL = process.env.REDIS_URL;
let redis: Redis | null = null;
if (REDIS_URL) {
  redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
}

// Fallback in-memory
interface MemoryEntry { count: number; resetAt: number }
const memoryStore = new Map<string, MemoryEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt <= now) memoryStore.delete(key);
  }
}, 60 * 1000).unref?.();

export interface RateLimitOptions {
  /** maksimal berapa kali */
  limit: number;
  /** jendela waktu dalam milidetik */
  windowMs: number;
  /** nama zona (dipakai sebagai prefix key) */
  name?: string;
}

async function hitCounter(key: string, limit: number, windowMs: number): Promise<{ count: number; resetAt: number } | null> {
  if (redis) {
    try {
      const current = await redis.incr(key);
      if (current === 1) await redis.pexpire(key, windowMs);
      const ttl = await redis.pttl(key);
      return { count: current, resetAt: Date.now() + (ttl > 0 ? ttl : windowMs) };
    } catch {
      // Redis down → fallback memory agar API tetap terlindungi
    }
  }
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { count: 1, resetAt: now + windowMs };
  }
  entry.count += 1;
  return { count: entry.count, resetAt: entry.resetAt };
}

export function rateLimit(opts: RateLimitOptions) {
  const zone = opts.name || 'default';
  return async (c: Context, next: () => Promise<void>) => {
    if (process.env.NODE_ENV === 'test') return next();
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
    const key = `ratelimit:${zone}:${ip}`;

    let result: { count: number; resetAt: number } | null;
    try {
      result = await hitCounter(key, opts.limit, opts.windowMs);
    } catch {
      // Gagal total → fail-open (jangan blokir user karena infra rate limiter)
      return next();
    }

    if (!result) return next();

    c.header('X-RateLimit-Limit', String(opts.limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, opts.limit - result.count)));

    if (result.count > opts.limit) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.' }, 429);
    }

    return next();
  };
}
