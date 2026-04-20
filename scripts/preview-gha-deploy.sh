#!/usr/bin/env bash
# Used by GitHub Actions: sync current checkout to preview host and run docker compose -p pr-<N>.
# Requires: gh ssh-agent loaded key, ssh access, env PREVIEW_SSH_HOST, PREVIEW_SEED_PASSWORD, GH_PR
# Optional: PREVIEW_PUBLIC_ORIGIN (e.g. https://pr-preview.equip-track.com) for path-based URLs /{pr}/
set -euo pipefail

USER="${PREVIEW_SSH_USER:-ubuntu}"
TARGET="${USER}@${PREVIEW_SSH_HOST}"
REMOTE_DIR="${PREVIEW_REMOTE_REPO_DIR:-/home/${USER}/preview/EquipTrack}"
GH_PR="${GH_PR:?}"

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
ssh-keyscan -H "${PREVIEW_SSH_HOST}" >> ~/.ssh/known_hosts

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

# Loopback only: public traffic hits edge nginx → /{pr}/ → this port
PREVIEW_BIND="127.0.0.1:${PREVIEW_HOST_PORT}"

PREVIEW_PATH_SEGMENT=""
PREVIEW_PUBLIC_ORIGIN="${PREVIEW_PUBLIC_ORIGIN:-}"
if [ -n "${PREVIEW_PUBLIC_ORIGIN}" ]; then
  PREVIEW_PATH_SEGMENT="${GH_PR}"
fi

ssh "${TARGET}" "cat > '${REMOTE_DIR}/.env.preview'" <<EOFENV
PREVIEW_SEED_PASSWORD=${PREVIEW_SEED_PASSWORD}
E2E_AUTH_SECRET=e2e-local-secret
PREVIEW_BIND=${PREVIEW_BIND}
PREVIEW_PATH_SEGMENT=${PREVIEW_PATH_SEGMENT}
PREVIEW_PUBLIC_ORIGIN=${PREVIEW_PUBLIC_ORIGIN}
EOFENV

# Prefer Docker Compose v2 (`docker compose`); many hosts still only have `docker-compose` v1.
ssh "${TARGET}" bash -s <<EOF
set -euo pipefail
cd "$(printf '%q' "${REMOTE_DIR}")"
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  echo "error: neither 'docker compose' nor docker-compose is available on the preview host" >&2
  exit 1
fi
"\${DC[@]}" -p pr-${GH_PR} -f docker-compose.preview.yml --env-file .env.preview up -d --build
"\${DC[@]}" -p pr-${GH_PR} -f docker-compose.preview.yml ps
EOF

if [ -n "${PREVIEW_PUBLIC_ORIGIN}" ]; then
  # Edge is optional until ~/preview-edge is provisioned; do not fail the job if reload/snippet fails.
  ssh "${TARGET}" \
    "cd '${REMOTE_DIR}' && PREVIEW_EDGE_SNIPPET_DIR=\"\${PREVIEW_EDGE_SNIPPET_DIR:-\$HOME/preview-edge/snippets}\" PREVIEW_EDGE_COMPOSE_FILE=\"\${PREVIEW_EDGE_COMPOSE_FILE:-\$HOME/preview-edge/docker-compose.yml}\" bash scripts/preview-edge-write-snippet.sh '${GH_PR}' '${PREVIEW_HOST_PORT}'" \
    || echo "::warning title=Preview edge::Edge nginx snippet or reload failed — main compose stack may still be up. Ensure ~/preview-edge exists and see docs/pr-preview-environments.md."
fi
