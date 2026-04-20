#!/usr/bin/env bash
# Run on the preview host (e.g. PR teardown). Removes edge snippet and reloads nginx.
# Intended: ssh ... "env GH_PR=... PREVIEW_PUBLIC_ORIGIN=... bash -s" < scripts/preview-edge-remove-snippet.sh
set -euo pipefail

GH_PR="${GH_PR:?}"
PREVIEW_PUBLIC_ORIGIN="${PREVIEW_PUBLIC_ORIGIN:-}"

if [ -z "${PREVIEW_PUBLIC_ORIGIN}" ]; then
  exit 0
fi

SNIP_DIR="${PREVIEW_EDGE_SNIPPET_DIR:-${HOME}/preview-edge/snippets}"
COMPOSE_FILE="${PREVIEW_EDGE_COMPOSE_FILE:-${HOME}/preview-edge/docker-compose.yml}"
rm -f "${SNIP_DIR}/pr-${GH_PR}.conf"

if [ -f "${COMPOSE_FILE}" ]; then
  COMPOSE_DIR="$(dirname "${COMPOSE_FILE}")"
  COMPOSE_BASE="$(basename "${COMPOSE_FILE}")"
  (
    cd "${COMPOSE_DIR}" &&
      docker compose -f "${COMPOSE_BASE}" exec -T preview-edge nginx -s reload
  ) 2>/dev/null || true
fi
