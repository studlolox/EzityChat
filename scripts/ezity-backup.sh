#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Ezity AI — Daily Automated Backup Script (Zero-Downtime)
# Dumps MongoDB databases and archives user uploads/canvas artifacts.
# ==============================================================================

BACKUP_ROOT="${EZITY_BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
RETENTION_DAYS="${EZITY_BACKUP_RETENTION_DAYS:-14}"
MONGO_CONTAINER="${MONGO_CONTAINER_NAME:-chat-mongodb}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Starting Ezity AI automated backup..."
echo "    Project Root:    ${PROJECT_ROOT}"
echo "    Target Directory: ${BACKUP_DIR}"

mkdir -p "${BACKUP_DIR}/mongo"

# 1. Dump MongoDB (users, chats, canvas, mindmaps, memories, encrypted credentials)
echo "--> Dumping MongoDB..."
if docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
  docker exec "${MONGO_CONTAINER}" mongodump --out /data/db/dump_tmp --quiet
  docker cp "${MONGO_CONTAINER}:/data/db/dump_tmp" "${BACKUP_DIR}/mongo/dump"
  docker exec "${MONGO_CONTAINER}" rm -rf /data/db/dump_tmp
  echo "    MongoDB dump completed via container ${MONGO_CONTAINER}."
else
  echo "    Container ${MONGO_CONTAINER} not running; attempting mongodump via MONGO_URI if available..."
  if command -v mongodump &>/dev/null && [ -n "${MONGO_URI:-}" ]; then
    mongodump --uri="${MONGO_URI}" --out="${BACKUP_DIR}/mongo/dump" --quiet
    echo "    MongoDB dump completed via local mongodump."
  else
    echo "    Notice: MongoDB container not running and local mongodump not available. Skipping DB dump step."
  fi
fi

# 2. Archive user uploads and canvas artifacts
echo "--> Archiving uploads directory..."
if [ -d "${PROJECT_ROOT}/uploads" ]; then
  tar -czf "${BACKUP_DIR}/uploads.tar.gz" -C "${PROJECT_ROOT}" uploads
  echo "    Uploads archived successfully ($(du -h "${BACKUP_DIR}/uploads.tar.gz" | cut -f1))."
else
  echo "    No uploads directory found at ${PROJECT_ROOT}/uploads; creating placeholder."
  tar -czf "${BACKUP_DIR}/uploads.tar.gz" --files-from /dev/null
fi

# 3. Generate SHA-256 checksums & backup manifest
echo "--> Creating backup manifest and SHA-256 checksums..."
cat <<EOF > "${BACKUP_DIR}/manifest.json"
{
  "timestamp": "${TIMESTAMP}",
  "git_commit": "$(git -C "${PROJECT_ROOT}" rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git -C "${PROJECT_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

(cd "${BACKUP_DIR}" && find . -type f ! -name "checksums.sha256" -exec shasum -a 256 {} + > "checksums.sha256")
echo "    Checksums written to ${BACKUP_DIR}/checksums.sha256."

# 4. Enforce 14-day rolling retention policy
echo "--> Enforcing ${RETENTION_DAYS}-day backup retention..."
if [ -d "${BACKUP_ROOT}" ]; then
  find "${BACKUP_ROOT}" -maxdepth 1 -mindepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +
fi

echo "==> Backup completed successfully: ${BACKUP_DIR}"

