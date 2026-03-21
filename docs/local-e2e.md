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

## CI

Core regression is automated via:

- `.github/workflows/e2e-localstack-core-regression.yml`

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
