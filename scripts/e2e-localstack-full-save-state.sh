#!/usr/bin/env bash
# Persist develop HEAD and package version after a successful full regression run.
set -euo pipefail

STATE_DIR=".ci/e2e-localstack-full-state"
STATE_FILE="${STATE_DIR}/state"

mkdir -p "${STATE_DIR}"
cat > "${STATE_FILE}" <<EOF
develop_sha=$(git rev-parse HEAD)
version=$(node -p "require('./package.json').version")
EOF

echo "Saved full regression state: $(tr '\n' ' ' < "${STATE_FILE}")"
