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

**Forms** (`Forms` table): three check-out forms seeded:
- `form-e2e-pending-checkout` (`status: pending`, description `e2e-seed-pending-checkout`)
- `form-e2e-approved-checkout` (`status: approved`, description `e2e-seed-approved-checkout`)
- `form-e2e-approved-checkout-partial-return` (`status: approved`, description `e2e-seed-approved-checkout-partial-return`) — has one embedded `CheckInEvent` returning 1 of 3 helmets; demonstrates the partial-return UI.

Plus a predefined kit form (`predefined-e2e-kit`).

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
- **Unit tests**: `npx nx run-many --target=test --all --exclude=frontend-e2e`
- **E2E tests**: `npm run e2e:local:test` (provisions LocalStack, installs Chromium, runs Playwright core regression). Chromium + system deps are pre-installed by the update script; to run the core regression alone: `E2E_SKIP_LOCAL_E2E_ENSURE=true PLAYWRIGHT_HTML_OPEN=never npx nx run frontend-e2e:e2e-local-core`.
- **Pre-commit hook** runs `npm run precommit` (lint + test affected + validate translations).

### Gotchas

- The Docker socket may need `sudo chmod 666 /var/run/docker.sock` if the current user is not in the `docker` group.
- Nx Cloud warnings about the FREE plan being exceeded are harmless — they just mean remote caching is disabled.
- The `e2e-login` endpoint requires the secret via the `x-e2e-secret` **header** (not in the request body). Playwright E2E helpers handle this automatically; see `apps/frontend-e2e/src/helpers/e2e-auth.ts`.
- The frontend defaults to **Hebrew (RTL)** localization. This is intentional. E2E automated tests force English via `localStorage['equip-track-language'] = 'en'`.
- **Google login will not work** in the Cloud Agent VM. Always use the E2E token flow described above.

## README

- **Read `README.md` at the start of every session** to orient yourself on the project structure, tech stack, testing commands, and CI/CD pipelines.
- If your work changes anything documented there (new workflows, updated commands, stack changes, new test suites, etc.), **update `README.md`** to keep it accurate before opening a pull request.

## Github context
- When asked about Github issue, pr, job etc., you can use gh cli to get more context

## Tests

When changes affect behavior, contracts, or user flows, **add or update automated tests** as appropriate. Cover **unit tests** for logic, services, and components where the project already uses them. Cover **end-to-end (e2e) tests** when the change touches integration across apps, APIs, or critical user journeys.

### Where each test lives

Group tests by the **module / screen / API surface they cover**, not by ad-hoc topic. One file per unit, named after that unit, co-located with it. Do not create top-level "smoke" or "example" specs.

| Layer | Location | One spec per |
|-------|----------|--------------|
| Frontend unit | `apps/frontend/src/**/<name>.spec.ts` (co-located with the source) | component / service / store / util |
| Backend unit | `apps/backend/src/**/<name>.spec.ts` (co-located with the source) | handler / adapter / service / helper |
| Shared lib | `libs/shared/src/**/<name>.spec.ts` (co-located) | exported function / module |
| E2E (UI) | `apps/frontend-e2e/src/screens/<route>.spec.ts` | screen (matches the route / `nav-link-<route>` test id) |
| E2E (cross-cutting) | `apps/frontend-e2e/src/<topic>.spec.ts` (root) | core regression / RBAC matrix / multi-screen journeys only |

> **Exception — `create-form.spec.ts`** lives at `apps/frontend-e2e/src/create-form.spec.ts` (root) rather than under `screens/` because it must run in both the `e2e-local-core` and `e2e-local-full` Nx targets. New screen-level tests for the create-form page belong in this file, not in a new `screens/create-form.spec.ts`.

Rules of thumb:

- A screen-level concern (e.g. "all-inventory loads", "search filters items") belongs in `screens/<that-screen>.spec.ts`, never in a root-level spec.
- A cross-cutting concern (e.g. "customer is redirected to `/not-allowed`" across multiple routes, or "inventory transfer end-to-end") belongs in the single canonical root spec for that concern. Do not assert the same RBAC redirect in three different per-screen specs.
- Pure helper / utility logic belongs in a `*.spec.ts` next to the source, not embedded in a component or e2e spec.

### Helpers — single source of truth

There are three canonical e2e helper modules. Always **import** from them; never re-implement these in a spec.

| File | Owns |
|------|------|
| `apps/frontend-e2e/src/helpers/e2e-auth.ts` | `mintE2eJwt`, `authenticateWithE2eToken` — minting JWTs via `/api/auth/e2e-login` |
| `apps/frontend-e2e/src/helpers/e2e-navigation.ts` | `bootstrapAuthenticatedSession`, `ensureOrganizationIsSelected`, `ensureInspectorLandsOnReportsHistory`, `clickSideNavRoute`, `openCreateFormPage`, `waitForTestId`, `fillInventoryRow`, `approveLatestPendingForm` — all browser session / nav / shared UI gestures |
| `apps/frontend-e2e/src/helpers/e2e-api.ts` | `E2E_ORG_ID` / `E2E_*_USER_ID` / `E2E_*_PRODUCT_ID` constants, `getUserInventory`, `getTotalInventory`, `addInventory`, `removeInventory`, `createForm`, `approveForm`, `rejectForm`, `getProducts`, `getUsers`, `itemByProductId` — all REST helpers and shared constants |

When you need a new shared gesture (e.g. a new dialog interaction, a new REST call used by ≥2 specs, a new "navigate-and-wait" pattern), **add it to the appropriate helper module and export it** — do not paste a copy into a spec. If a needed helper does not exist yet, add it before writing the test.

Do not pin literals that are already exported. Examples:

- ❌ Hardcoding `'org-e2e-main'` / `'user-e2e-admin'` / `'prod-bulk-helmet'` in a spec → ✅ import `E2E_ORG_ID` / `E2E_ADMIN_USER_ID` / `E2E_BULK_PRODUCT_ID` from `e2e-api.ts`.
- ❌ Hardcoding the Google OAuth client ID in a unit spec → ✅ import `environment.googleClientId`.

For Angular unit tests, the standard `TestBed` quartet (`NoopAnimationsModule`, `TranslateModule.forRoot()`, `provideHttpClient()`, `provideHttpClientTesting()`) is acceptable boilerplate today, but if you introduce a new shared test fixture (custom `MAT_DIALOG_DATA`, a fake store, etc.), put it in a sibling `*.testing.ts` file so other specs can reuse it.

### How to write an organized spec

For each new spec (or substantial change to an existing one), check this list before writing or merging:

1. **Does a spec for this unit already exist?** If yes, add the new case there. Do **not** create a parallel spec file.
2. **Am I copying code I could import?** If you are about to paste a `bootstrapAuthenticatedSession`, `mintE2eJwt`, `getUserInventory`, or similar function into a spec — stop and `import` it instead. If the canonical version doesn't fit, **extend the helper** rather than forking it.
3. **Am I asserting something already asserted elsewhere?** RBAC redirects, login flows, org selection, and seeded-data sanity checks each live in exactly one canonical spec. Add to it, don't duplicate it.
4. **Is the test wired to a runner?** New e2e specs under `apps/frontend-e2e/src/screens/` are picked up by `e2e-local-full` automatically. New root-level e2e specs (cross-cutting / core regression) must be added explicitly to the `e2e-local-core` and `e2e-local-full` command in `apps/frontend-e2e/project.json`, otherwise they will never run.
5. **Does the test exercise real code?** Do not write tests that define a helper inline and then assert against that inline helper — that tests test-code, not production code.
6. **Is the wait correct?** Prefer `expect.poll`, `page.waitForResponse`, or `expect(locator).toHaveX(...)` over `page.waitForTimeout(N)` in e2e specs.

### Before committing

- ✅ `npx nx run-many --target=test --all --exclude=frontend-e2e` (or at minimum the affected projects via `nx affected`).
- ✅ `npx nx run frontend-e2e:e2e-local-core` for changes that touch UI behavior, e2e helpers, or any spec under `apps/frontend-e2e/`.
- If you touched any e2e helper (`apps/frontend-e2e/src/helpers/*.ts`), also run `npx nx run frontend-e2e:e2e-local-full` because every screen spec depends on those helpers.
- Reset LocalStack state if the full suite previously ran and consumed mutable seed data: `npm run e2e:local:stack:reset && npm run e2e:local:prepare`, then restart the backend so it re-reads JWT keys from Secrets Manager.

## UI changes — screenshots required

When a fix or feature touches the **UI** (templates, styles, components, layouts, or anything visually observable), the agent **must** include **before/after screenshots** (or a demo video) of the affected screens in the **pull request description** and in the **final response walkthrough**.

- Capture screenshots by running the full-stack locally (backend + frontend) and using the `computerUse` subagent to navigate to the relevant page.
- For bug fixes: show the broken state **before** the fix (if reproducible) and the corrected state **after**.
- For new features: show the feature in its final working state, covering both the happy path and any important edge cases (empty states, error states, RTL layout, etc.).
- Include the artifacts using HTML `<img>` / `<video>` tags in both the PR body and the final message so reviewers can visually verify the change without running the app.
- If the UI cannot be rendered in the agent environment (e.g., missing external service), explain why and describe what the expected visual result should be.

## Pull requests and CI

- When work maps to a **GitHub issue**, **link it in the pull request** so the issue **closes automatically on merge**. Use a closing keyword in the PR description (for example `Fixes #123`, `Closes #123`, or `Resolves #123`), or otherwise ensure the PR is associated with the issue per repository conventions.
- After **creating a pull request**, **monitor its status** using the **GitHub CLI** (`gh`), for example checks and mergeability.
- If checks fail or the PR reports problems, **investigate, fix the underlying issues**, push updates, and **re-check** until the PR is in a good state (or the failure is clearly external and documented).
