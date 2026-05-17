# EquipTrack

EquipTrack is an internal application designed to monitor the supply and location of organizational equipment.

## App Goals

### From the users' perspective

1. Check equipment in and out.
2. Report the location of critical equipment.
3. View all the equipment they have checked out.

### From the warehouse's perspective

1. Add or remove items from inventory.
2. Track the inventory.
3. Generate a check-out form for specific equipment for a specific user and obtain their signature.
4. Use pre-defined check-out forms.
5. Record partial or full check-ins (returns) directly on an approved check-out form — see which items are still outstanding and print a PDF for each return event.
6. Notify users with daily reports.
7. Generate reports on equipment status.
8. Look up a specific item to see who checked it out.
9. View the check-out history and return events of an item.
10. View the report history of an item.

### Check-in (return) flow

Returns are recorded as events on the original approved check-out form rather than as a separate form type:

1. The warehouse manager opens the **Forms** screen and finds an approved check-out form (optionally filter by approval status and by **returning status**: not returned, partially returned, or fully returned).
2. The card shows a **return status** badge (not returned until the first return event, then partially returned or fully returned), **outstanding items** (original items minus already-returned quantities/UPIs), and **return history** (past check-in events with date, approver, items, and a PDF print link).
3. The manager clicks **Check in items**, selects the items to return (constrained to outstanding items), and draws their signature in the dialog.
4. On submit, inventory transfers from the user back to the warehouse, the event is appended to the form, and a PDF is generated and stored in S3.
5. When all items are returned, the form is marked as **fully returned**.

### From the admin perspective

1. Create and delete users.
2. Assign users the warehouse role.

---

## Product Types

The app manages two types of products:

**Products without Unique Product Identifiers (UPI)**
- Users can check out multiple items simultaneously.

**Products with Unique Product Identifiers (UPI)**
- Each item must be checked out individually.
- Users are assigned specific items.
- Users are required to report their status daily.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Monorepo** | [Nx](https://nx.dev) |
| **Frontend** | Angular |
| **Backend** | Node.js (AWS Lambda) |
| **API Gateway** | AWS SAM (generated from shared endpoint definitions) |
| **Database** | DynamoDB |
| **Storage / CDN** | S3 + CloudFront |
| **Cloud** | AWS (`il-central-1`) |
| **Local infra (E2E)** | LocalStack via Docker |

---

## Project Structure

```
apps/
  frontend/        Angular application
  frontend-e2e/    Playwright end-to-end tests
  backend/         Node.js Lambda handlers
libs/
  shared/          Shared types and API surface definitions
infra/
  sam/             AWS SAM template (auto-generated — do not edit by hand)
scripts/           Build, deploy, and test automation
.github/workflows/ GitHub Actions CI/CD pipelines
```

---

## Development

### Prerequisites

- **Node.js 20+** and **npm**
- **Docker** (required for local E2E tests with LocalStack)
- **AWS SAM CLI** (required for deploying the backend stack)

### Install

```bash
npm install
```

### Run the full stack locally

```bash
npm run fullstack
```

This starts both the Angular dev server (`http://localhost:4200`) and the backend server.

### Regenerate the SAM template

The `infra/sam/template.yaml` file is generated from the shared endpoint definitions. Never edit it manually.

```bash
npm run generate:sam
```

---

## Testing

### Unit Tests

Run unit tests for all projects:

```bash
npx nx run-many -t test --all
```

Run tests for a specific project:

```bash
npx nx test frontend   # Angular (jest-preset-angular)
npx nx test backend    # Node.js (ts-jest)
npx nx test shared     # Shared library (ts-jest)
```

Coverage reports are written to `coverage/`.

### Linting

```bash
npx nx run-many -t lint --all
```

### Pre-commit hook

[Husky](https://typicode.github.io/husky/) runs lint and unit tests for all affected, uncommitted files automatically before each commit, and also validates translation keys:

```bash
# Equivalent to what the hook runs:
npx nx affected -t lint,test --uncommitted --nxBail --exclude=frontend-e2e
npm run validate:translations
```

### E2E Tests (Playwright)

E2E tests live in `apps/frontend-e2e/` and use Playwright with Chromium (CI) or Chromium/Firefox/WebKit (local).

#### Local E2E against LocalStack

Requires Docker. Spins up LocalStack, seeds test fixtures, and runs the **core** regression suite:

```bash
npm run e2e:local:test
```

To run only specific steps manually:

```bash
npm run e2e:local:prepare          # start LocalStack + seed fixtures
npx nx run frontend-e2e:e2e-local-core   # core suite
npx nx run frontend-e2e:e2e-local-full   # full suite
npm run e2e:local:stack:down       # tear down LocalStack
```

#### E2E against a deployed environment

```bash
BASE_URL=https://app.example.com \
BACKEND_BASE_URL=https://api.example.com \
npm run e2e:deployed:test
```

The `E2E_AUTH_SECRET` environment variable (or GitHub secret) must match the value configured on the backend.

See [`docs/local-e2e.md`](docs/local-e2e.md) for full setup instructions.

---

## CI / CD

All pipelines run on **GitHub Actions**.

### Pull Request checks

Every PR targeting `main` or `develop` runs two parallel jobs:

| Job | What it does |
|---|---|
| **Lint & unit tests** | `npx nx run-many -t lint,test --all` |
| **Core regression (LocalStack)** | Spins up LocalStack → seeds data → runs Playwright core suite |

In addition, every PR (and every push to `develop`) runs **SAM API Template** validation, which regenerates `infra/sam/template.yaml` and checks it is committed and passes `sam validate --lint`.

### Versioning

On every push to `master` or `develop` (excluding version-bump commits), the **Auto Version Bump** workflow:

1. Bumps the semver in `package.json` and the Angular environment files.
2. Tags the commit (`v<version>`).
3. Creates a GitHub Release (pre-release for `develop`, stable for `master`).

Use `[skip version]` on the **first line** of the commit message to suppress the bump.

### Deployment

Deployment is triggered automatically when a version tag `v*` is pushed:

| Tag format | Target environment |
|---|---|
| `v1.2.3-beta.0` (pre-release) | **development** (`dev` stage) |
| `v1.2.3` (stable) | **production** |

The deploy workflow uses Nx affected analysis to deploy only the apps that changed. The deployment sequence is:

1. Build backend and/or frontend (Nx affected).
2. Create DynamoDB tables (if needed).
3. Seed E2E fixture data (dev only).
4. Package and deploy Lambda functions + API Gateway via SAM.
5. Deploy frontend to S3; create/update CloudFront distribution.
6. Invalidate CloudFront cache.

Add `force full deployment` to the commit message to bypass affected analysis and force a full deploy.

### Post-deploy E2E

After every successful development-stage deploy, the **E2E Deployed Core After Develop Deploy** workflow automatically runs the Playwright core regression suite against the live dev environment (requires the `E2E_DEV_FRONTEND_URL` and `E2E_DEV_BACKEND_URL` repository variables to be set).

The **E2E Deployed Core Regression** workflow can also be triggered manually (`workflow_dispatch`) against any environment.

### Nightly full regression

The **E2E LocalStack Full Regression** workflow is scheduled every night at **00:15 UTC**. It runs the complete Playwright suite against LocalStack only when `develop` has new commits or the package version changed since the last **successful** run; otherwise the workflow exits after a quick check. Manual runs (`workflow_dispatch`) always execute the full suite. GitHub may start scheduled runs later than the cron time when Actions load is high.

### Workflow summary

| Workflow | Trigger |
|---|---|
| E2E LocalStack Core Regression | PR → `main` / `develop` |
| SAM API Template | PR + push to `develop` |
| Auto Version Bump | Push to `master` / `develop` |
| Deploy Full Stack to AWS | Version tag `v*` |
| E2E Deployed Core After Develop Deploy | After successful dev deploy |
| E2E Deployed Core Regression | Manual (`workflow_dispatch`) |
| E2E LocalStack Full Regression | Nightly 00:15 UTC |
