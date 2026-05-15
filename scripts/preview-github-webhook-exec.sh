#!/usr/bin/env bash
# Called by preview-github-webhook.cjs after a verified GitHub delivery (deploy or teardown).
# Loads secrets from PREVIEW_WEBHOOK_ENV_FILE (default /etc/equiptrack/preview-webhook.env).
set -euo pipefail

ENV_FILE="${PREVIEW_WEBHOOK_ENV_FILE:-/etc/equiptrack/preview-webhook.env}"
if [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a
fi

ACTION="${1:?action deploy|teardown}"
GH_PR="${2:?pr number}"

export GH_PR
export PREVIEW_REMOTE_REPO_DIR="${PREVIEW_REMOTE_REPO_DIR:-/home/ubuntu/preview/EquipTrack}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${ACTION}" in
  deploy)
    bash "${SCRIPT_DIR}/preview-webhook-git-sync.sh"
    bash "${SCRIPT_DIR}/preview-deploy-local.sh"
    ;;
  teardown)
    bash "${SCRIPT_DIR}/preview-teardown-local.sh"
    ;;
  *)
    echo "preview-github-webhook-exec: unknown action: ${ACTION}" >&2
    exit 1
    ;;
esac
