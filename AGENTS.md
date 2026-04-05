# Agent instructions

Guidance for autonomous coding agents working in this repository.

## Cursor Cloud specific instructions

This repository defines a [Cloud Agent environment](https://cursor.com/docs/cloud-agent/setup) in `.cursor/environment.json`: the VM image includes Docker (fuse-overlayfs storage driver) and on each session start runs LocalStack from `docker-compose.e2e.yml` (port **4566**), then seeds DynamoDB tables, S3 buckets, JWT secrets, and E2E fixture data.

- **AWS emulated endpoint**: `http://localhost:4566` (same as local E2E; see `docs/local-e2e.md`).
- **Bring up / reprovision LocalStack** (idempotent): `npm run e2e:local:stack:up` or `docker compose -f docker-compose.e2e.yml up -d --wait localstack`.
- **Seed DynamoDB, S3, Secrets Manager** after LocalStack is healthy: `npm run e2e:local:setup` (uses `AWS_ENDPOINT_URL` / test credentials like local E2E). This runs automatically on environment start via `.cursor/environment.json`.
- **Full local E2E stack** (LocalStack + seed + browsers + tests): see `docs/local-e2e.md` and scripts under `npm run e2e:local:*`.

If Docker or LocalStack fails inside a nested container, follow Cursor's [Running Docker](https://cursor.com/docs/cloud-agent/setup#running-docker) troubleshooting (storage driver / iptables).

### Pre-seeded data available on startup

The environment start script seeds the following E2E fixture data into LocalStack. This data is available immediately when the backend serves.

**Organization**: `org-e2e-main` ("EquipTrack E2E Organization"), one department `dep-ops` ("Operations").

**Users** (in `UsersAndOrganizations` table):

| User ID | Role |
|---------|------|
| `user-e2e-admin` | `admin` |
| `user-e2e-warehouse` | `warehouse-manager` |
| `user-e2e-customer` | `customer` |
| `user-e2e-inspector` | `inspector` |

**Products & inventory** (`Inventory` table): Safety Helmet (`prod-bulk-helmet`, bulk: 20 warehouse / 3 customer), Laptop (`prod-upi-laptop`, UPI items `LAP-WH-001`–`003` in warehouse, `LAP-CUST-001` with customer).

**Forms** (`Forms` table): sample pending-checkout, approved-checkout, rejected-check-in forms, plus a predefined kit form.

**Reports** (`EquipTrackReport` table): two report rows for today (Asia/Jerusalem timezone).

To re-seed from scratch: `npm run e2e:local:stack:reset && npm run e2e:local:prepare`.

### Language / localization (Hebrew default)

The frontend defaults to **Hebrew (RTL)**. The language is persisted in `localStorage` under the key `equip-track-language` (see `STORAGE_KEYS.LANGUAGE` in `apps/frontend/src/utils/consts.ts`). On first visit, `LanguageService` defaults to `he` and sets `document.dir` to `rtl`.

When testing the UI manually (via `computerUse` subagent), the app **will render in Hebrew** unless you explicitly override the language. This is the intended default.

E2E automated tests force English by setting `localStorage['equip-track-language'] = 'en'` via Playwright's `addInitScript` before navigation (see `apps/frontend-e2e/src/helpers/e2e-auth.ts`).

### Authentication (E2E token — Google login is unavailable)

**Google Sign-In does not work** inside the Cloud Agent VM (no real Google OAuth credentials). Use the **E2E token login** endpoint instead, which is the same mechanism Playwright E2E tests use.

#### How to obtain a JWT token

The backend (when started with `npm run backend:serve:e2e-local`) exposes `POST /api/auth/e2e-login`. Send a request with the shared secret in a header and the desired identity in the body:

```bash
curl -s -X POST http://localhost:3000/api/auth/e2e-login \
  -H 'Content-Type: application/json' \
  -H 'x-e2e-secret: e2e-local-secret' \
  -d '{"userId":"user-e2e-admin","orgIdToRole":{"org-e2e-main":"admin"}}' \
  | jq -r '.jwt'
```

Available seeded users: `user-e2e-admin` (`admin`), `user-e2e-warehouse` (`warehouse-manager`), `user-e2e-customer` (`customer`), `user-e2e-inspector` (`inspector`). All belong to org `org-e2e-main`.

#### How to authenticate the browser

The frontend reads the JWT from `localStorage` key `equip-track-token`. To log in without Google:

1. Start the backend: `npm run backend:serve:e2e-local` (in a background terminal).
2. Start the frontend: `npm run frontend:serve:e2e-local` (in another background terminal).
3. Mint a token using the `curl` command above.
4. In the browser console (or via Playwright/`computerUse` `addInitScript`), set `localStorage`:
   ```js
   localStorage.setItem('equip-track-token', '<jwt-from-step-3>');
   localStorage.setItem('equip-track-selected-org', 'org-e2e-main');
   ```
5. Reload the page — the app will treat the session as authenticated.

See `apps/frontend-e2e/src/helpers/e2e-auth.ts` for the canonical Playwright implementation of this flow (`mintE2eJwt` + `authenticateWithE2eToken`).

**Key environment variables** (already set by `backend:serve:e2e-local`):

| Variable | Value | Purpose |
|----------|-------|---------|
| `E2E_AUTH_ENABLED` | `true` | Enables the `/api/auth/e2e-login` endpoint |
| `E2E_AUTH_SECRET` | `e2e-local-secret` | Shared secret sent in `x-e2e-secret` header |

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
- The frontend defaults to **Hebrew (RTL)** localization. This is intentional. E2E automated tests force English via `localStorage['equip-track-language'] = 'en'`.
- **Google login will not work** in the Cloud Agent VM. Always use the E2E token flow described above.

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
