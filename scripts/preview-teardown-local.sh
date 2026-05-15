#!/usr/bin/env bash
# Run on the preview host: remove compose stack and edge snippet for a PR.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

GH_PR="${GH_PR:?}"
PREVIEW_PUBLIC_ORIGIN="${PREVIEW_PUBLIC_ORIGIN:-}"

if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  echo "preview-teardown-local: docker compose not found" >&2
  exit 1
fi

"${DC[@]}" -p "pr-${GH_PR}" -f docker-compose.preview.yml down -v || true

if [ -n "${PREVIEW_PUBLIC_ORIGIN}" ]; then
  export GH_PR PREVIEW_PUBLIC_ORIGIN
  bash "${SCRIPT_DIR}/preview-edge-remove-snippet.sh" || true
fi
