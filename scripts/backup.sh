#!/usr/bin/env bash
# ============================================================
# Backup database E-Learning (pg_dump via Docker)
#
# Pemakaian:
#   ./scripts/backup.sh                 # backup ke ./backups/
#   KEEP_DAYS=14 ./scripts/backup.sh    # simpan 14 hari terakhir
#
# Cron harian (contoh, jam 02.00):
#   0 2 * * * cd /path/ke/elearning-new && ./scripts/backup.sh >> backups/cron.log 2>&1
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

DB_CONTAINER="${DB_CONTAINER:-elearning_db}"
DB_NAME="${DB_NAME:-elearning}"
DB_USER="${DB_USER:-user}"
BACKUP_DIR="$(pwd)/backups"
KEEP_DAYS="${KEEP_DAYS:-7}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_DIR}/elearning-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Is)] Memulai backup ${DB_NAME} (container: ${DB_CONTAINER})..."

if ! docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$DEST"; then
  echo "GAGAL: backup tidak berhasil" >&2
  rm -f "$DEST"
  exit 1
fi

SIZE="$(du -h "$DEST" | cut -f1)"
echo "[$(date -Is)] Berhasil: $DEST ($SIZE)"

# Rotasi: hapus backup lebih tua dari KEEP_DAYS hari
find "$BACKUP_DIR" -name 'elearning-*.sql.gz' -type f -mtime "+${KEEP_DAYS}" -print -delete \
  | sed 's/^/[$(date -Is)] Menghapus backup lama: /'

echo "[$(date -Is)] Selesai. Retensi: ${KEEP_DAYS} hari."
