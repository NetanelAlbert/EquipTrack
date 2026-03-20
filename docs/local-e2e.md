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

Equivalent Nx target:

```bash
npx nx run frontend-e2e:e2e-local-core
```

## CI

Core regression is automated via:

- `.github/workflows/e2e-localstack-core-regression.yml`

## Seeded identities

- `user-e2e-admin` (role: `admin`)
- `user-e2e-warehouse` (role: `warehouse-manager`)
- `user-e2e-customer` (role: `customer`)

Organization:

- `org-e2e-main`
