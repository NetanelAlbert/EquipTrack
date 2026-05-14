#!/usr/bin/env bash
# Retries LocalStack compose up for transient registry rate limits (CI / shared runners).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="${ROOT}/docker-compose.e2e.yml"
max_attempts="${E2E_LOCALSTACK_UP_RETRIES:-5}"
delay="${E2E_LOCALSTACK_UP_RETRY_DELAY_SEC:-20}"

for attempt in $(seq 1 "${max_attempts}"); do
  echo "e2e:local:stack:up attempt ${attempt}/${max_attempts}"
  if docker compose -f "${COMPOSE}" up -d --wait localstack; then
    exit 0
  fi
  if [ "${attempt}" -eq "${max_attempts}" ]; then
    echo "LocalStack compose up failed after ${max_attempts} attempts" >&2
    exit 1
  fi
  echo "Retrying in ${delay}s..."
  sleep "${delay}"
  delay=$((delay + 10))
done
