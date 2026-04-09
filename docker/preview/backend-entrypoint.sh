#!/bin/sh
set -eu

export STAGE="${STAGE:-docker}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localstack:4566}"
export AWS_ENDPOINT_URL_DYNAMODB="${AWS_ENDPOINT_URL_DYNAMODB:-$AWS_ENDPOINT_URL}"
export AWS_ENDPOINT_URL_S3="${AWS_ENDPOINT_URL_S3:-$AWS_ENDPOINT_URL}"
export AWS_ENDPOINT_URL_SECRETSMANAGER="${AWS_ENDPOINT_URL_SECRETSMANAGER:-$AWS_ENDPOINT_URL}"

export E2E_AUTH_ENABLED="${E2E_AUTH_ENABLED:-true}"
export E2E_AUTH_SECRET="${E2E_AUTH_SECRET:-e2e-docker-preview-secret}"
export LOCAL_HTTP_SERVER=true
export BACKEND_LISTEN_HOST="${BACKEND_LISTEN_HOST:-0.0.0.0}"
export BACKEND_PORT="${BACKEND_PORT:-3000}"

LS_URL="${AWS_ENDPOINT_URL}"
echo "[preview-backend] Waiting for LocalStack at ${LS_URL}..."
i=0
while [ "$i" -lt 60 ]; do
  if curl -fsS "${LS_URL}/_localstack/health" > /dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if ! curl -fsS "${LS_URL}/_localstack/health" > /dev/null 2>&1; then
  echo "[preview-backend] LocalStack did not become ready in time" >&2
  exit 1
fi

echo "[preview-backend] Provisioning DynamoDB, S3, secrets, seed data..."
node scripts/setup-local-e2e.js

echo "[preview-backend] Starting HTTP API on ${BACKEND_LISTEN_HOST}:${BACKEND_PORT}"
exec node main.js
