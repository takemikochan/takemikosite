#!/usr/bin/env bash
# CMS（PostgreSQL + アップロード画像）の日次バックアップ。
# root の cron から実行する想定（/etc/takemiko-cms.env の読み取りに root 権限が必要なため）。
set -euo pipefail

BACKUP_DIR=/var/backups/takemiko
UPLOADS_DIR=/opt/takemiko-cms/public/uploads
ENV_FILE=/etc/takemiko-cms.env
KEEP_GENERATIONS=14

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)

PGPASSWORD="$DATABASE_PASSWORD" pg_dump \
  -h "${DATABASE_HOST:-localhost}" \
  -p "${DATABASE_PORT:-5432}" \
  -U "$DATABASE_USERNAME" \
  -d "$DATABASE_NAME" \
  | gzip > "$BACKUP_DIR/db-$TIMESTAMP.sql.gz"

if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
fi

# 世代管理：DB・uploadsそれぞれ直近 KEEP_GENERATIONS 件だけ残す
find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sql.gz' -type f | sort -r | tail -n "+$((KEEP_GENERATIONS + 1))" | xargs -r rm -f
find "$BACKUP_DIR" -maxdepth 1 -name 'uploads-*.tar.gz' -type f | sort -r | tail -n "+$((KEEP_GENERATIONS + 1))" | xargs -r rm -f

echo "[backup-cms] completed: $TIMESTAMP"
