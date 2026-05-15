#!/usr/bin/env bash
# Run on the preview host with sources already synced (rsync) or checked out (git).
# Writes .env.preview and runs docker compose + optional edge snippet.
# Env: GH_PR (required), PREVIEW_SEED_PASSWORD, PREVIEW_REMOTE_REPO_DIR, PREVIEW_PUBLIC_ORIGIN,
#      PREVIEW_HOST_PORT_BASE, E2E_AUTH_SECRET (optional)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

GH_PR="${GH_PR:?}"

if ! [[ "${GH_PR}" =~ ^[0-9]+$ ]]; then
  echo "preview-deploy-local: GH_PR must be a number, got: ${GH_PR}" >&2
  exit 1
fi

PREVIEW_HOST_PORT_BASE="${PREVIEW_HOST_PORT_BASE:-30000}"
PREVIEW_HOST_PORT_BASE="${PREVIEW_HOST_PORT_BASE//[^0-9]/}"
if [ -z "${PREVIEW_HOST_PORT_BASE}" ]; then
  PREVIEW_HOST_PORT_BASE=30000
fi
PREVIEW_HOST_PORT=$((PREVIEW_HOST_PORT_BASE + GH_PR))
if [ "${PREVIEW_HOST_PORT}" -ge 65536 ]; then
  echo "preview-deploy-local: PR #${GH_PR} too large for port formula" >&2
  exit 1
fi

PREVIEW_BIND="127.0.0.1:${PREVIEW_HOST_PORT}"
PREVIEW_PATH_SEGMENT=""
PREVIEW_PUBLIC_ORIGIN="${PREVIEW_PUBLIC_ORIGIN:-}"
if [ -n "${PREVIEW_PUBLIC_ORIGIN}" ]; then
  PREVIEW_PATH_SEGMENT="${GH_PR}"
fi

PREVIEW_SEED_PASSWORD="${PREVIEW_SEED_PASSWORD:?PREVIEW_SEED_PASSWORD is required}"

cat >"${REPO_ROOT}/.env.preview" <<EOFENV
PREVIEW_SEED_PASSWORD=${PREVIEW_SEED_PASSWORD}
E2E_AUTH_SECRET=${E2E_AUTH_SECRET:-e2e-local-secret}
PREVIEW_BIND=${PREVIEW_BIND}
PREVIEW_PATH_SEGMENT=${PREVIEW_PATH_SEGMENT}
PREVIEW_PUBLIC_ORIGIN=${PREVIEW_PUBLIC_ORIGIN}
EOFENV

if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  echo "preview-deploy-local: neither docker compose nor docker-compose found" >&2
  exit 1
fi

"${DC[@]}" -p "pr-${GH_PR}" -f docker-compose.preview.yml --env-file .env.preview up -d --build
"${DC[@]}" -p "pr-${GH_PR}" -f docker-compose.preview.yml ps

if [ -n "${PREVIEW_PUBLIC_ORIGIN}" ]; then
  PREVIEW_EDGE_SNIPPET_DIR="${PREVIEW_EDGE_SNIPPET_DIR:-${HOME}/preview-edge/snippets}"
  PREVIEW_EDGE_COMPOSE_FILE="${PREVIEW_EDGE_COMPOSE_FILE:-${HOME}/preview-edge/docker-compose.yml}"
  export PREVIEW_EDGE_SNIPPET_DIR PREVIEW_EDGE_COMPOSE_FILE
  bash "${SCRIPT_DIR}/preview-edge-write-snippet.sh" "${GH_PR}" "${PREVIEW_HOST_PORT}" \
    || echo "preview-deploy-local: edge snippet/reload failed (non-fatal)"
fi
