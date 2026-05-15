#!/usr/bin/env bash
# Used by preview-github-webhook: clone or fetch PR head into REPO_ROOT.
# Env: PREVIEW_GIT_REMOTE_URL (default https://github.com/NetanelAlbert/EquipTrack.git), GH_PR
set -euo pipefail

REPO_ROOT="${PREVIEW_REMOTE_REPO_DIR:?}"
GH_PR="${GH_PR:?}"
REMOTE_URL="${PREVIEW_GIT_REMOTE_URL:-https://github.com/NetanelAlbert/EquipTrack.git}"

if [ ! -d "${REPO_ROOT}/.git" ]; then
  mkdir -p "$(dirname "${REPO_ROOT}")"
  git clone "${REMOTE_URL}" "${REPO_ROOT}"
fi

cd "${REPO_ROOT}"
git remote set-url origin "${REMOTE_URL}"
git fetch origin --prune
git fetch origin "+refs/pull/${GH_PR}/head:refs/heads/preview-pr-${GH_PR}"
git checkout "preview-pr-${GH_PR}"
