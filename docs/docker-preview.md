# Docker full-stack preview (LocalStack)

Run the **Angular app + local HTTP backend + LocalStack** (DynamoDB, S3, Secrets Manager) in Docker — no AWS account required.

For **hosted PR previews on real AWS** (unique URL per PR, automatic cleanup), see [pr-preview-environments.md](./pr-preview-environments.md). The UI is served on **port 4280**; the browser calls **`/api/...`** on the same origin and nginx proxies to the backend.

## Prerequisites

- Docker with Compose v2
- Nothing required on ports **4280** or **4566** (change the host mapping in `docker-compose.preview.yml` if needed)

## Start

```bash
npm run docker:preview:up
```

Open [http://localhost:4280](http://localhost:4280).

First start **builds images** (Nx build inside Docker); expect several minutes.

## Stop

```bash
npm run docker:preview:down
```

Remove volumes (clean database / LocalStack data):

```bash
npm run docker:preview:reset
```

## Authentication

The preview stack enables **`/api/auth/e2e-login`** (same mechanism as local E2E). Default secret in compose: **`e2e-docker-preview-secret`**.

Example (mint JWT, then set `localStorage` in the browser as in `AGENTS.md`):

```bash
curl -s -X POST http://localhost:4280/api/auth/e2e-login \
  -H 'Content-Type: application/json' \
  -H 'x-e2e-secret: e2e-docker-preview-secret' \
  -d '{"userId":"user-e2e-admin","orgIdToRole":{"org-e2e-main":"admin"}}'
```

Seeded users and org match [local E2E fixtures](./local-e2e.md#seeded-identities).

Override the secret by setting `E2E_AUTH_SECRET` for the `backend` service in `docker-compose.preview.yml` (keep frontend/runtime in sync only if you add a custom login path; e2e-login uses the backend env).

## Implementation notes

- **Backend** listens on `0.0.0.0` via `BACKEND_LISTEN_HOST` (set in the image entrypoint).
- **Runtime config** uses `useSameOriginForApi: true` so `ApiService` calls `/api/...` relative to the nginx host.
- **Stage** is `docker` → DynamoDB tables are suffixed `-docker` inside LocalStack.
- **Images** are defined in `docker/preview/Dockerfile` (multi-stage: builder, `preview-backend`, `preview-frontend`).
