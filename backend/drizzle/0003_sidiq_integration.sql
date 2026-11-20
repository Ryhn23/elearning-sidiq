-- Migration: 0003_sidiq_integration.sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sidiq_user_id" varchar(100) UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sidiq_entity_id" varchar(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sidiq_role" varchar(50);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nis_nip" varchar(50);

ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "sidiq_pelajaran_id" varchar(100);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "sidiq_kelas_id" varchar(100);

CREATE TABLE IF NOT EXISTS "sidiq_sync_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_type" varchar(50) NOT NULL,
  "event_id" varchar(100) NOT NULL UNIQUE,
  "payload" text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "last_error" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ssq_event_id_idx" ON "sidiq_sync_queue" ("event_id");
CREATE INDEX IF NOT EXISTS "ssq_status_idx" ON "sidiq_sync_queue" ("status");
