# AWS PR preview environments (issue #155)

Per-pull-request **full stack on real AWS**: isolated `STAGE=pr-<number>`, DynamoDB tables `*-pr-<n>`, dedicated API + frontend hostnames, seeded data, **email/password login** (preview-only), automatic teardown when the PR closes.

## What runs in CI

| Workflow | When |
|----------|------|
| [`.github/workflows/deploy-pr-preview.yml`](../.github/workflows/deploy-pr-preview.yml) | Non-draft PR opened/updated against `develop` or `main` |
| [`.github/workflows/cleanup-pr-preview.yml`](../.github/workflows/cleanup-pr-preview.yml) | PR merged or closed |

The deploy job is **skipped** until the **`PR_PREVIEW_SEED_PASSWORD`** repository secret exists (so forks/CI stay green before ops setup). After the secret is added, each qualifying PR gets a deploy.

## Required GitHub configuration

Use **Settings → Environments → `development` → Environment secrets** (same as the main dev deploy workflow). The preview workflow’s first job runs in that environment so secrets resolve correctly.

| Secret | Purpose |
|--------|---------|
| `PR_PREVIEW_SEED_PASSWORD` | Shared password for **all** seeded preview users (scrypt-hashed in DynamoDB; not in git). Share with reviewers via your normal secure channel. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Same as development deploys (or scoped IAM for preview resources). |
| `API_GATEWAY_REGIONAL_CERTIFICATE_ARN` | ACM cert that covers `*.equip-track.com` (or your `BASE_DOMAIN`) so `pr-<n>-api.<domain>` works. |

**Do not** rely on repository-level secrets for `PR_PREVIEW_SEED_PASSWORD` alone if the deploy job uses `environment: development`: GitHub does **not** expose environment secrets in job-level `if` conditions, so the workflow uses a small **prerequisite job** that runs in `development` and only then gates the deploy.

### Manual validation

After changing secrets, run **Actions → Deploy PR preview → Run workflow**: enter a PR number (and optional git ref). This uses the same deploy steps as pull requests.

## URLs and login

- **App:** `https://pr-<PR_NUMBER>.equip-track.com` (override with `BASE_DOMAIN` / `FRONTEND_DOMAIN` in scripts if you fork the domain layout)
- **API:** `https://pr-<PR_NUMBER>-api.equip-track.com`

Seeded users (same as E2E fixtures) include **admin, warehouse-manager, customer, inspector** — e.g. `e2e.admin@example.com`, `e2e.warehouse@example.com`, etc. They all use the **same** password: the value of `PR_PREVIEW_SEED_PASSWORD`.

The login page shows **email + password** only when the deployed `runtime-config.json` sets `featurePreviewLoginEnabled` (the workflow does this). Google sign-in remains for other environments.

## Cleanup

On PR close, `scripts/pr-preview-teardown.js` removes the SAM stack, preview DynamoDB tables, S3 buckets (`equip-track-frontend-pr-*`, `equip-track-lambda-code-pr-*`), and the Route53 **A** record for `pr-<n>.<BASE_DOMAIN>`.

## Local / Docker alternative

For **no-AWS** full-stack runs (LocalStack in Docker), see [docker-preview.md](./docker-preview.md). That path does **not** replace the AWS preview URLs above; it complements local and CI smoke testing.
