#!/usr/bin/env bash
# Bump package.json version for CI based on GITHUB_REF (master = patch, develop = pre-release).
# Updates frontend environment version strings. New version is read from package.json after this exits.
set -euo pipefail

ref="${GITHUB_REF:?GITHUB_REF must be set}"

case "$ref" in
  refs/heads/master)
    # npm version prints the new version to stdout; keep stdout clean for CI (GITHUB_OUTPUT / captures).
    npm version patch --no-git-tag-version >/dev/null
    ;;
  refs/heads/develop)
    current=$(node -p "require('./package.json').version")
    if [[ "$current" == *-* ]]; then
      npm version prerelease --preid=beta --no-git-tag-version >/dev/null
    else
      npm version prepatch --preid=beta --no-git-tag-version >/dev/null
    fi
    ;;
  *)
    echo "Unsupported ref for version bump: $ref" >&2
    exit 1
    ;;
esac

new_version=$(node -p "require('./package.json').version")

sed -i "s/version: '[^']*'/version: '$new_version'/g" apps/frontend/src/environments/environment.ts
sed -i "s/version: '[^']*'/version: '$new_version'/g" apps/frontend/src/environments/environment.prod.ts
