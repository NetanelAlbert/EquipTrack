#!/usr/bin/env bash
# Used by GitHub Actions: sync current checkout to preview host and run docker compose -p pr-<N>.
# Requires: gh ssh-agent loaded key, ssh access, env PREVIEW_SSH_HOST, PREVIEW_SEED_PASSWORD, GH_PR
# Optional: PREVIEW_PUBLIC_ORIGIN (e.g. https://pr-preview.equip-track.com) for path-based URLs /{pr}/
set -euo pipefail

USER="${PREVIEW_SSH_USER:-ubuntu}"
TARGET="${USER}@${PREVIEW_SSH_HOST}"
REMOTE_DIR="${PREVIEW_REMOTE_REPO_DIR:-/home/${USER}/preview/EquipTrack}"
GH_PR="${GH_PR:?}"

echo "preview-gha-deploy: PR=${GH_PR} host=${PREVIEW_SSH_HOST:-?} user=${PREVIEW_SSH_USER:-ubuntu} remote_dir=${PREVIEW_REMOTE_REPO_DIR:-default}"

if ! [[ "${GH_PR}" =~ ^[0-9]+$ ]]; then
  echo "::error::GH_PR must be a number, got: ${GH_PR}"
  exit 1
fi

# GitHub vars may be empty or malformed; sanitize so arithmetic never fails.
PREVIEW_HOST_PORT_BASE="${PREVIEW_HOST_PORT_BASE:-30000}"
PREVIEW_HOST_PORT_BASE="${PREVIEW_HOST_PORT_BASE//[^0-9]/}"
if [ -z "${PREVIEW_HOST_PORT_BASE}" ]; then
  PREVIEW_HOST_PORT_BASE=30000
fi
PREVIEW_HOST_PORT=$((PREVIEW_HOST_PORT_BASE + GH_PR))
if [ "${PREVIEW_HOST_PORT}" -ge 65536 ]; then
  echo "::error::PR #${GH_PR} is too large for default port formula (30000 + PR < 65536). Set PREVIEW_HOST_PORT_BASE lower or adjust the formula."
  exit 1
fi

mkdir -p ~/.ssh
# Do not fail the job if keyscan is blocked (some networks block port 22 to metadata scans).
# SSH below uses StrictHostKeyChecking=accept-new and will still add the host key on first connect.
if ! ssh-keyscan -T 10 -H "${PREVIEW_SSH_HOST}" >> ~/.ssh/known_hosts 2>/dev/null; then
  echo "::notice title=preview-gha-deploy::ssh-keyscan failed or timed out — continuing (first SSH may still succeed)."
fi

if ! ssh -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new \
  "${TARGET}" "echo preview-ssh-ok" 2>/dev/null; then
  echo "::notice title=Preview host::SSH to ${PREVIEW_SSH_HOST} failed — instance may be stopped or unreachable. Skipping preview deploy for PR #${GH_PR}."
  exit 0
fi

ssh "${TARGET}" "mkdir -p '${REMOTE_DIR}'"
rsync -az --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude dist \
  --exclude .nx \
  ./ "${TARGET}:${REMOTE_DIR}/"

ssh "${TARGET}" \
  "cd '${REMOTE_DIR}' && \
  export GH_PR='${GH_PR}' PREVIEW_SEED_PASSWORD='${PREVIEW_SEED_PASSWORD}' PREVIEW_PUBLIC_ORIGIN='${PREVIEW_PUBLIC_ORIGIN}' \
  PREVIEW_HOST_PORT_BASE='${PREVIEW_HOST_PORT_BASE:-}' E2E_AUTH_SECRET='e2e-local-secret' \
  PREVIEW_EDGE_SNIPPET_DIR=\"\${PREVIEW_EDGE_SNIPPET_DIR:-\$HOME/preview-edge/snippets}\" \
  PREVIEW_EDGE_COMPOSE_FILE=\"\${PREVIEW_EDGE_COMPOSE_FILE:-\$HOME/preview-edge/docker-compose.yml}\" && \
  bash scripts/preview-deploy-local.sh"
