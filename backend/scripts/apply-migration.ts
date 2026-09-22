/**
 * Jalankan file migrasi SQL drizzle secara langsung ke database.
 * Usage: npx tsx scripts/apply-migration.ts <file.sql>
 */
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx scripts/apply-migration.ts <file.sql>');
  process.exit(1);
}

(async () => {
  const connectionString = process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/elearning';
  const sql = postgres(connectionString, { max: 1 });

  const query = readFileSync(file, 'utf-8');
  await sql.unsafe(query);
  console.log(`✅ Applied ${file}`);
  await sql.end();
})();
