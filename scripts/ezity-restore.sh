#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Ezity AI — Disaster Recovery & Backup Restoration Script
# Restores MongoDB databases and unpacks user uploads from a backup snapshot.
# ==============================================================================

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-backup-directory>"
  echo "Example: $0 ./backups/2026-11-10_020000"
  exit 1
fi

RESTORE_SRC="$(cd "$1" && pwd)"
MONGO_CONTAINER="${MONGO_CONTAINER_NAME:-chat-mongodb}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Starting Ezity AI Disaster Recovery..."
echo "    Backup Source: ${RESTORE_SRC}"
echo "    Project Root:  ${PROJECT_ROOT}"

# 1. Verify Checksums
if [ -f "${RESTORE_SRC}/checksums.sha256" ]; then
  echo "--> Verifying SHA-256 checksums..."
  (cd "${RESTORE_SRC}" && shasum -a 256 -c checksums.sha256)
  echo "    Checksum verification passed."
else
  echo "    Warning: checksums.sha256 not found in backup directory."
fi

# 2. Restore MongoDB
echo "--> Restoring MongoDB data..."
if [ -d "${RESTORE_SRC}/mongo/dump" ]; then
  if docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    docker cp "${RESTORE_SRC}/mongo/dump" "${MONGO_CONTAINER}:/data/db/restore_tmp"
    docker exec "${MONGO_CONTAINER}" mongorestore --drop /data/db/restore_tmp --quiet
    docker exec "${MONGO_CONTAINER}" rm -rf /data/db/restore_tmp
    echo "    MongoDB restored successfully into container ${MONGO_CONTAINER}."
  elif command -v mongorestore &>/dev/null && [ -n "${MONGO_URI:-}" ]; then
    mongorestore --drop --uri="${MONGO_URI}" "${RESTORE_SRC}/mongo/dump" --quiet
    echo "    MongoDB restored successfully via local mongorestore."
  else
    echo "    Notice: Cannot restore MongoDB: container ${MONGO_CONTAINER} is not running and local mongorestore not available."
  fi
else
  echo "    No mongo/dump directory found in backup."
fi

# 3. Restore User Uploads
echo "--> Restoring uploads directory..."
if [ -f "${RESTORE_SRC}/uploads.tar.gz" ]; then
  mkdir -p "${PROJECT_ROOT}"
  tar -xzf "${RESTORE_SRC}/uploads.tar.gz" -C "${PROJECT_ROOT}"
  echo "    Uploads unpacked successfully into ${PROJECT_ROOT}/uploads."
else
  echo "    No uploads.tar.gz found in backup."
fi

echo "==> Disaster Recovery restoration completed successfully."
echo "    Verify by running: docker compose up -d"

