#!/usr/bin/env bash
# Bring up LocalStack for E2E. Retries on transient registry errors (e.g. rate limits) in CI.
set -u
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
max_attempts=6
delay=4
attempt=1
while [[ "${attempt}" -le "${max_attempts}" ]]; do
  if (cd "${ROOT_DIR}" && docker compose -f docker-compose.e2e.yml up -d --wait localstack); then
    exit 0
  fi
  if [[ "${attempt}" -eq "${max_attempts}" ]]; then
    echo "e2e-localstack-stack-up: all ${max_attempts} attempts failed" >&2
    exit 1
  fi
  echo "e2e-localstack-stack-up: attempt ${attempt} failed, waiting ${delay}s before retry..." >&2
  sleep "${delay}"
  delay=$((delay * 2))
  attempt=$((attempt + 1))
done
