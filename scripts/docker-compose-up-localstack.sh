#!/usr/bin/env bash
# Start LocalStack for E2E (same as npm run e2e:local:stack:up) with retries when
# the registry returns rate limits (e.g. Docker Hub 429 on GitHub-hosted runners).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.e2e.yml}"
SERVICE="${LOCALSTACK_COMPOSE_SERVICE:-localstack}"
MAX_ATTEMPTS="${LOCALSTACK_DOCKER_UP_RETRIES:-5}"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if docker compose -f "$COMPOSE_FILE" up -d --wait "$SERVICE"; then
    exit 0
  fi
  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    wait_sec=$((4 * attempt))
    echo "[localstack-up] compose up failed (attempt ${attempt}/${MAX_ATTEMPTS}); waiting ${wait_sec}s before retry…" >&2
    sleep "$wait_sec"
  fi
done

echo "[localstack-up] docker compose failed after ${MAX_ATTEMPTS} attempts" >&2
exit 1
