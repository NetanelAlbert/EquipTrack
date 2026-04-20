#!/usr/bin/env bash
# Tear down a PR preview stack on the remote host (compose down -v).
# Usage: PREVIEW_SSH_TARGET=user@host ./scripts/preview-remote-teardown.sh <pr_number>
set -euo pipefail

PR_NUMBER="${1:?PR number required}"
PROJECT="pr-${PR_NUMBER}"
REPO_DIR="${PREVIEW_REMOTE_REPO_DIR:-~/EquipTrack}"

echo "[preview-remote-teardown] PR=${PR_NUMBER} target=${PREVIEW_SSH_TARGET:?Set PREVIEW_SSH_TARGET}"

ssh "${PREVIEW_SSH_TARGET}" bash -s <<EOF
set -euo pipefail
cd "${REPO_DIR}"
docker compose -p "${PROJECT}" -f docker-compose.preview.yml --env-file .env.preview down -v || true
echo "[preview-remote-teardown] Removed ${PROJECT}"
EOF
