#!/usr/bin/env bash
# Optional cron on the preview host: remove compose projects for PRs that are no longer open.
# Requires gh CLI authenticated on the host and PREVIEW_SSH_TARGET if run locally.
# Usage on host: GITHUB_REPO=owner/repo ./scripts/preview-sweeper.sh
set -euo pipefail

REPO="${GITHUB_REPO:?Set GITHUB_REPO=owner/name}"
MAP_FILE="${PREVIEW_PR_MAP_FILE:-/var/lib/equiptrack-preview/pr-projects.map}"

if [[ ! -f "${MAP_FILE}" ]]; then
  echo "[preview-sweeper] No map file at ${MAP_FILE} — nothing to do."
  exit 0
fi

open_prs="$(gh pr list --repo "${REPO}" --state open --json number -q '.[].number' | tr '\n' ' ')"
while read -r line; do
  [[ -z "${line}" ]] && continue
  pr="${line%%=*}"
  project="${line#*=}"
  if [[ " ${open_prs} " != *" ${pr} "* ]]; then
    echo "[preview-sweeper] PR #${pr} not open — removing ${project}"
    docker compose -p "${project}" -f docker-compose.preview.yml down -v || true
    grep -v "^${pr}=" "${MAP_FILE}" > "${MAP_FILE}.tmp" && mv "${MAP_FILE}.tmp" "${MAP_FILE}"
  fi
done < "${MAP_FILE}"
