#!/usr/bin/env bash
# Bring up LocalStack for E2E with retries. CI runners sometimes hit Docker Hub
# rate limits on image pulls; spacing retries often succeeds on a later attempt.
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.e2e.yml}"
SERVICE="${LOCALSTACK_COMPOSE_SERVICE:-localstack}"
MAX_ATTEMPTS="${E2E_LOCALSTACK_PULL_ATTEMPTS:-5}"
BASE_DELAY_SEC="${E2E_LOCALSTACK_PULL_RETRY_DELAY_SEC:-25}"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "LocalStack compose: attempt ${attempt} of ${MAX_ATTEMPTS} (pull + up --wait ${SERVICE})"
  if compose pull "$SERVICE" && compose up -d --wait "$SERVICE"; then
    exit 0
  fi
  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    delay=$((BASE_DELAY_SEC * attempt))
    echo "Pull or up failed; waiting ${delay}s before retry..."
    sleep "$delay"
  fi
done

echo "LocalStack stack up failed after ${MAX_ATTEMPTS} attempts" >&2
exit 1
