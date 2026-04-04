# Agent instructions

Guidance for autonomous coding agents working in this repository.

## Cursor Cloud specific instructions

This repository defines a [Cloud Agent environment](https://cursor.com/docs/cloud-agent/setup) in `.cursor/environment.json`: the VM image includes Docker (fuse-overlayfs storage driver) and on each session start runs LocalStack from `docker-compose.e2e.yml` (port **4566**).

- **AWS emulated endpoint**: `http://localhost:4566` (same as local E2E; see `docs/local-e2e.md`).
- **Bring up / reprovision LocalStack** (idempotent): `npm run e2e:local:stack:up` or `docker compose -f docker-compose.e2e.yml up -d --wait localstack`.
- **Seed DynamoDB, S3, Secrets Manager** after LocalStack is healthy: `npm run e2e:local:setup` (uses `AWS_ENDPOINT_URL` / test credentials like local E2E).
- **Full local E2E stack** (LocalStack + seed + browsers + tests): see `docs/local-e2e.md` and scripts under `npm run e2e:local:*`.

If Docker or LocalStack fails inside a nested container, follow Cursor’s [Running Docker](https://cursor.com/docs/cloud-agent/setup#running-docker) troubleshooting (storage driver / iptables).

### Running the full-stack locally

- **Backend** (port 3000): `npm run backend:serve:e2e-local` — builds then starts the local HTTP server with E2E auth enabled and all AWS SDK env vars pointing at LocalStack.
- **Frontend** (port 4200): `npm run frontend:serve:e2e-local` — writes runtime config and starts Angular dev server pointing at `localhost:3000`.
- **Both together**: Start in separate terminals; the backend must be running before the frontend makes API calls.
- **Lint**: `npx nx run-many --target=lint --all`
- **Unit tests**: `npx nx run-many --target=test --all --exclude=frontend-e2e,backend-e2e`
- **E2E tests**: `npm run e2e:local:test` (provisions LocalStack, installs Chromium, runs Playwright core regression). Chromium + system deps are pre-installed by the update script; to run the core regression alone: `E2E_SKIP_LOCAL_E2E_ENSURE=true PLAYWRIGHT_HTML_OPEN=never npx nx run frontend-e2e:e2e-local-core`.
- **Pre-commit hook** runs `npm run precommit` (lint + test affected + validate translations).

### Gotchas

- The Docker socket may need `sudo chmod 666 /var/run/docker.sock` if the current user is not in the `docker` group.
- Nx Cloud warnings about the FREE plan being exceeded are harmless — they just mean remote caching is disabled.
- The `e2e-login` endpoint requires the secret via the `x-e2e-secret` **header** (not in the request body). Playwright E2E helpers handle this automatically; see `apps/frontend-e2e/src/helpers/e2e-auth.ts`.
- The frontend defaults to Hebrew (RTL) localization. E2E tests force English via the `E2E_LANGUAGE_STORAGE_KEY` localStorage key.

## Github context
- When asked about Github issue, pr, job etc., you can use gh cli to get more context

## Tests

- When changes affect behavior, contracts, or user flows, **add or update automated tests** as appropriate.
- Cover **unit tests** for logic, services, and components where the project already uses them.
- Cover **end-to-end (e2e) tests** when the change touches integration across apps, APIs, or critical user journeys and e2e coverage exists or is clearly warranted.

## Pull requests and CI

- When work maps to a **GitHub issue**, **link it in the pull request** so the issue **closes automatically on merge**. Use a closing keyword in the PR description (for example `Fixes #123`, `Closes #123`, or `Resolves #123`), or otherwise ensure the PR is associated with the issue per repository conventions.
- After **creating a pull request**, **monitor its status** using the **GitHub CLI** (`gh`), for example checks and mergeability.
- If checks fail or the PR reports problems, **investigate, fix the underlying issues**, push updates, and **re-check** until the PR is in a good state (or the failure is clearly external and documented).
