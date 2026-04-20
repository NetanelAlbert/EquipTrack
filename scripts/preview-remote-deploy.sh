#!/usr/bin/env bash
# Deploy or refresh the PR preview stack on a remote Docker host over SSH.
# Usage: PREVIEW_SSH_TARGET=user@preview-host.example.com PREVIEW_SEED_PASSWORD=*** \
#   ./scripts/preview-remote-deploy.sh <pr_number> [ref=HEAD]
set -euo pipefail

PR_NUMBER="${1:?PR number required}"
REF="${2:-HEAD}"
REPO_DIR="${PREVIEW_REMOTE_REPO_DIR:-~/EquipTrack}"
PROJECT="pr-${PR_NUMBER}"

echo "[preview-remote-deploy] PR=${PR_NUMBER} ref=${REF} target=${PREVIEW_SSH_TARGET:?Set PREVIEW_SSH_TARGET}"

ssh "${PREVIEW_SSH_TARGET}" bash -s <<EOF
set -euo pipefail
cd "${REPO_DIR}"
git fetch origin
git checkout "${REF}"
docker compose -p "${PROJECT}" -f docker-compose.preview.yml --env-file .env.preview up -d --build
echo "[preview-remote-deploy] Stack ${PROJECT} is up."
docker compose -p "${PROJECT}" -f docker-compose.preview.yml ps
EOF
