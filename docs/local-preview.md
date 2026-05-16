# Local preview stack

Spin up a fully seeded local stack (LocalStack + backend + nginx) that matches what reviewers see in the preview environment. No AWS account needed.

## Quick start

```bash
# 1. One-time: create your local env file
cp .env.preview.example .env.preview
# Edit .env.preview and set PREVIEW_SEED_PASSWORD to any string, e.g.:
#   PREVIEW_SEED_PASSWORD=preview-local-dev

# 2. Build and start (takes ~2 min on first run)
npm run preview:compose:up

# 3. Open the app
open http://127.0.0.1:8080
```

## Sign in

All seeded users share the same password — the value of `PREVIEW_SEED_PASSWORD` you set in `.env.preview`.

| Email | Role |
|-------|------|
| `e2e.admin@example.com` | admin |
| `e2e.warehouse@example.com` | warehouse-manager |
| `e2e.customer@example.com` | customer |
| `e2e.inspector@example.com` | inspector |

The login page shows an email/password form when the preview stack is running (Google Sign-In is also available if credentials are configured).

> **Language note**: the app defaults to Hebrew. Use the in-app language toggle (bottom of the side-nav) to switch to English.

## Tear down

```bash
npm run preview:compose:down
```

This stops all containers and removes the LocalStack volume, so the next `up` starts from a clean seed.

## Common tasks

| Task | Command |
|------|---------|
| Rebuild after code change | `npm run preview:compose:up` (re-builds images) |
| Follow backend logs | `docker compose -f docker-compose.preview.yml logs -f backend` |
| Force a clean re-seed | `npm run preview:compose:down && npm run preview:compose:up` |
| Check container status | `docker compose -f docker-compose.preview.yml ps` |

## How it works

```
browser → nginx (127.0.0.1:8080)
             ├── /api/*  → backend:3000  (Node HTTP server)
             └── /*      → Angular SPA (production build)

backend ──→ LocalStack:4566  (DynamoDB, S3, Secrets Manager)
```

The backend runs in `preview` stage mode with `FEATURE_PREVIEW_AUTH_ENABLED=true`, which enables the email/password login endpoint (`POST /api/auth/feature-preview-password`). The Angular build is produced with `apiUrl=same-origin` so all API calls go through the nginx proxy.
