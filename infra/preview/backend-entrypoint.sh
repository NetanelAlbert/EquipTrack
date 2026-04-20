#!/bin/sh
set -eu

export STAGE="${STAGE:-preview}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localstack:4566}"
export AWS_ENDPOINT_URL_DYNAMODB="${AWS_ENDPOINT_URL_DYNAMODB:-$AWS_ENDPOINT_URL}"
export AWS_ENDPOINT_URL_S3="${AWS_ENDPOINT_URL_S3:-$AWS_ENDPOINT_URL}"
export AWS_ENDPOINT_URL_SECRETSMANAGER="${AWS_ENDPOINT_URL_SECRETSMANAGER:-$AWS_ENDPOINT_URL}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export E2E_FORMS_BUCKET="${E2E_FORMS_BUCKET:-equip-track-forms}"

echo "[preview-entrypoint] Waiting for LocalStack at ${AWS_ENDPOINT_URL}..."
i=0
while [ "$i" -lt 60 ]; do
  if curl -fsS "${AWS_ENDPOINT_URL}/_localstack/health" >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

echo "[preview-entrypoint] Running setup-local-e2e (tables, secrets, seed)..."
node /app/scripts/setup-local-e2e.js

echo "[preview-entrypoint] Starting backend HTTP server on ${BACKEND_PORT:-3000}..."
exec node /app/dist/apps/backend/main.js
