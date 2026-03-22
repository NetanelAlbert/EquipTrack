# Local E2E Infrastructure (Docker + LocalStack)

This setup provisions local AWS dependencies used by backend E2E flows:

- DynamoDB
- S3
- Secrets Manager

## Prerequisites

- Docker
- Node/npm dependencies installed (`npm ci`)

## Start and provision

```bash
npm run e2e:local:prepare
```

This command:

1. Starts LocalStack via `docker-compose.e2e.yml`
2. Creates DynamoDB tables for `STAGE=local`
3. Creates `equip-track-forms` bucket
4. Creates JWT key secrets in LocalStack Secrets Manager
5. Seeds deterministic E2E organization/users/products/inventory

## Useful commands

```bash
# Start only LocalStack
npm run e2e:local:stack:up

# Provision resources without restarting containers
npm run e2e:local:setup

# Stop containers
npm run e2e:local:stack:down

# Stop and remove volumes (clean slate)
npm run e2e:local:stack:reset
```

## Run Playwright against local stack

```bash
npm run e2e:local:test
```

This command provisions LocalStack resources, starts backend/frontend with local E2E configuration, and runs Playwright (Chromium project).
It also installs the Chromium Playwright browser if missing.
It executes the core regression set (`core-regression.spec.ts` and `core-regression-ui.spec.ts`).
It sets `E2E_SKIP_LOCAL_E2E_ENSURE=true` for the Nx step because `e2e:local:prepare` already ran setup.

Equivalent Nx target:

```bash
npx nx run frontend-e2e:e2e-local-core
```

The `e2e-local-core` target runs `scripts/ensure-local-e2e-before-playwright.js` first: it probes LocalStack; if nothing is listening it runs `docker compose … up -d localstack` (same as `e2e:local:stack:up`), waits until the endpoint is ready, then runs `e2e:local:setup`. So after a clean slate you can run:

```bash
npm run e2e:local:stack:reset
npx nx run frontend-e2e:e2e-local-core
```

Set `E2E_SKIP_LOCAL_E2E_ENSURE=true` to skip the ensure step entirely (CI / `e2e:local:test` after prepare). Set `E2E_SKIP_LOCALSTACK_AUTO_UP=true` to only probe + setup without starting Docker (use a manually managed LocalStack).

Those Playwright Nx targets use `cache: false` (see `apps/frontend-e2e/project.json`): end-to-end results must not be reused from the Nx cache, and this avoids spurious **“Nx detected a flaky task”** hints when a past failure was cached.

## Deployed environment run

To run the same core regression test against a deployed environment:

```bash
BASE_URL="https://your-frontend.example.com" \
BACKEND_BASE_URL="https://your-api.example.com" \
E2E_AUTH_SECRET="your-e2e-secret" \
npm run e2e:deployed:test
```

This uses `apps/frontend-e2e/playwright.deployed.config.ts` (no local web servers).

## Seeded identities

- `user-e2e-admin` (role: `admin`)
- `user-e2e-warehouse` (role: `warehouse-manager`)
- `user-e2e-customer` (role: `customer`)

Organization:

- `org-e2e-main`

## Environment variables (local)

| Variable | Typical value | Purpose |
|----------|---------------|---------|
| `E2E_AUTH_SECRET` | `e2e-local-secret` (local default) | Shared secret for `/api/auth/e2e-login` |
| `E2E_AUTH_ENABLED` | `true` | Enables the test-only login path on the backend |
| `BACKEND_BASE_URL` | `http://localhost:3000` | API base for Playwright / API tests |
| `BASE_URL` | `http://localhost:4200` | Frontend base for Playwright |
| `E2E_SKIP_LOCAL_E2E_ENSURE` | `true` | Skip ensure script when infra was prepared already (e.g. CI after `e2e:local:prepare`) |
| `E2E_SKIP_LOCALSTACK_AUTO_UP` | `true` | Do not start Docker from the ensure script; expect LocalStack already running |
| `STAGE` | `local` | Backend stage for table/bucket naming |
| `AWS_ENDPOINT_URL*` | `http://localhost:4566` | LocalStack endpoints for AWS SDK (see `backend:serve:e2e-local` in `package.json`) |

Deployed runs use the GitHub Environment secret `E2E_AUTH_SECRET` plus URLs from manual workflow inputs or from repository variables for the post-deploy workflow; see [github-environments-setup.md](./github-environments-setup.md#-e2e-workflow-environment-secrets).

## CI behavior

- **LocalStack core regression**: `.github/workflows/e2e-localstack-core-regression.yml` runs on pull requests targeting `main` / `develop` and on pushes to `develop`. It runs lint + unit tests, then `e2e:local:prepare` and `nx run frontend-e2e:e2e-local-core` (Chromium, `workers=1`). Artifacts: Playwright HTML report and `test-results`, plus a summarized failure context log.
- **Deployed core regression (manual)**: `.github/workflows/e2e-deployed-core-regression.yml` is **`workflow_dispatch`**: pick environment, frontend URL, and API URL. It does not start local Docker.
- **Deployed core regression (after develop deploy)**: `.github/workflows/e2e-deployed-after-develop-deploy.yml` runs when [Deploy Full Stack to AWS](.github/workflows/deploy-fullstack.yml) completes successfully on `develop`. It is **skipped** unless repository variables `E2E_DEV_FRONTEND_URL` and `E2E_DEV_BACKEND_URL` are set (Settings → Secrets and variables → Actions → Variables). It checks out the same commit as the deploy (`workflow_run.head_sha`) and uses the **development** GitHub Environment for `E2E_AUTH_SECRET`.

## Troubleshooting

- **LocalStack not healthy**: Run `npm run e2e:local:stack:down` then `npm run e2e:local:prepare`, or `npm run e2e:local:stack:reset` for a clean volume.
- **Port 4566 / 3000 / 4200 in use**: Stop conflicting processes or adjust compose ports / `BACKEND_BASE_URL` / `BASE_URL` consistently in Playwright env.
- **Playwright “browser not installed”**: Run `npm run e2e:local:install-browsers` or `npx playwright install chromium`.
- **Auth failures in tests**: Ensure backend was started with `E2E_AUTH_ENABLED=true` and the same `E2E_AUTH_SECRET` the tests use (`e2e-local-secret` for local scripts).
- **Flaky Nx cache on E2E**: `frontend-e2e` e2e targets set `cache: false`; if you run Playwright outside Nx, do not rely on cached failures as green.
- **CI failures**: Download the workflow artifacts (report + test-results) and check the “Summarize Playwright failure contexts” step output.

## GitHub epic (issue mapping)

The end-to-end testing initiative was tracked as **E2E-0002** through **E2E-0701** on GitHub. Implementation is on `develop`; prerequisite **E2E-0001** is [#40](https://github.com/NetanelAlbert/EquipTrack/issues/40) (closed). Remaining epic tickets [#41](https://github.com/NetanelAlbert/EquipTrack/issues/41)–[#53](https://github.com/NetanelAlbert/EquipTrack/issues/53) map to: stable `data-testid` selectors; LocalStack compose + bootstrap + seed scripts; local HTTP adapter; guarded `e2e-login`; AWS endpoint overrides; frontend runtime API URL; Playwright helpers and core regression specs; blocking LocalStack CI; manual and post-`develop`-deploy deployed workflows; and this runbook (plus [github-environments-setup.md](./github-environments-setup.md)). Notable merges: [#54](https://github.com/NetanelAlbert/EquipTrack/pull/54), [#70](https://github.com/NetanelAlbert/EquipTrack/pull/70), [#71](https://github.com/NetanelAlbert/EquipTrack/pull/71).
