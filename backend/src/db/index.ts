import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/elearning';

// Pool & timeout eksplisit agar koneksi tidak menumpuk saat beban tinggi.
const client = postgres(connectionString, {
  max: Number(process.env.DB_POOL_MAX) || 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

/** Cek konektivitas DB untuk endpoint readiness. */
export async function checkDatabase(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await client.end();
}
