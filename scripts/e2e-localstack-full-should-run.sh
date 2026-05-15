#!/usr/bin/env bash
# Decide whether the nightly LocalStack full regression should run Playwright tests.
# Skips when develop HEAD and package version are unchanged since the last successful run.
set -euo pipefail

STATE_DIR=".ci/e2e-localstack-full-state"
STATE_FILE="${STATE_DIR}/state"

write_output() {
  local run_tests="$1"
  local reason="$2"
  echo "${reason}"
  echo "run_tests=${run_tests}" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
}

if [[ "${GITHUB_EVENT_NAME:-}" == "workflow_dispatch" ]]; then
  write_output "true" "Manual workflow_dispatch — always run full regression."
  exit 0
fi

git fetch --quiet origin develop
current_sha="$(git rev-parse origin/develop)"
current_version="$(node -p "require('./package.json').version")"

if [[ ! -f "${STATE_FILE}" ]]; then
  write_output "true" "No prior successful run state — running full regression (develop @ ${current_sha}, v${current_version})."
  exit 0
fi

# shellcheck disable=SC1090
source "${STATE_FILE}"

if [[ "${develop_sha:-}" != "${current_sha}" ]]; then
  write_output "true" "develop advanced (${develop_sha:-none} -> ${current_sha}) — running full regression."
  exit 0
fi

if [[ "${version:-}" != "${current_version}" ]]; then
  write_output "true" "Version changed (${version:-none} -> ${current_version}) — running full regression."
  exit 0
fi

write_output "false" "No changes on develop since last successful full regression (${current_sha}, v${current_version})."
