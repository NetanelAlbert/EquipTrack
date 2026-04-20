# PR preview environments (shared host + LocalStack)

This implements [issue #155](https://github.com/NetanelAlbert/EquipTrack/issues/155) **without provisioning a separate AWS SAM stack per PR**. Each preview is an isolated **Docker Compose** project on a **single shared machine** (typically one EC2 instance or equivalent). The “database” is **LocalStack DynamoDB** inside that compose stack, suitable for **UI and behavior** validation—not production parity.

## Hosting choice

| Approach | Use when |
|----------|----------|
| **Shared EC2 + Docker Compose** (default) | You want minimal ops cost and straightforward debugging. One DNS name (e.g. `pr-preview.example.com`) can point at the host; use **path-based** routes (`/123/`) plus an **edge** reverse proxy, or per-PR subdomains if you prefer isolation (see below). |
| **EKS** | Only if you already run a cluster and want namespace isolation per PR. Adds control-plane and ingress complexity for a workload that is otherwise a few containers. |

## What runs in each preview

- **LocalStack** (DynamoDB, S3, Secrets Manager)
- **Backend** Node HTTP server (`LOCAL_HTTP_SERVER`) with `FEATURE_PREVIEW_AUTH_ENABLED=true`
- **Nginx** (`preview-web`) serving the Angular production build and proxying `/api` to the backend

Compose file: [docker-compose.preview.yml](../docker-compose.preview.yml). Docker build contexts: [infra/preview/Dockerfile.backend](../infra/preview/Dockerfile.backend), [infra/preview/Dockerfile.preview-web](../infra/preview/Dockerfile.preview-web).

## URLs, ports, and path-based previews

### Local / single stack (default)

- Compose binds **`127.0.0.1:8080`** → inner nginx unless you override `PREVIEW_BIND` (see [.env.preview.example](../.env.preview.example)).
- **Runtime API**: `same-origin` — the browser uses the same host for `/api/*`.

### Shared host: many PRs (recommended layout)

- Each PR stack publishes **preview-web** on **loopback only** at a **unique port** so many stacks can coexist:
  - **Formula (default in CI):** `PREVIEW_HOST_PORT = PREVIEW_HOST_PORT_BASE + PR_NUMBER` (defaults: base `30000`, so PR `123` → `127.0.0.1:30123`).
  - Override the base with environment variable **`PREVIEW_HOST_PORT_BASE`** if the range collides with other services.
- **Do not** bind `0.0.0.0:80` per stack; only one process can own a port. Public HTTP(S) is handled by a **single edge** (below).

### Single hostname + path prefix `/{pr}/`

- Point **one DNS record** (A/ALIAS) at the instance or load balancer, e.g. `pr-preview.example.com`.
- **Edge** nginx (or AWS **ALB/NLB**) terminates TLS and routes:
  - `https://pr-preview.example.com/123/...` → `http://127.0.0.1:<port-for-123>/...` with the **`/123` prefix stripped** so inner [nginx-preview.conf](../infra/preview/nginx-preview.conf) still serves `/` and `/api/`.
- **Angular** is built with `--base-href /{pr}/` and runtime **`apiUrl`** set to `https://pr-preview.example.com/{pr}` (no trailing slash) so API calls become `.../{pr}/api/...`.

**Repository / CI variable:** set **`PREVIEW_PUBLIC_ORIGIN`** to the public origin **without a path** (e.g. `https://pr-preview.example.com`). GitHub Actions passes it into [scripts/preview-gha-deploy.sh](../scripts/preview-gha-deploy.sh); when it is set, the deploy also writes **`PREVIEW_PATH_SEGMENT`** to the PR number and registers an **edge nginx snippet**.

**localStorage caveat:** Browsers treat `https://pr-preview.example.com/123` and `/456` as the **same origin** (same host, scheme, and port). **JWT and other `localStorage` keys are shared** across PR paths in one browser profile. Reviewers comparing two previews should use separate profiles or incognito; **subdomains per PR** avoid that at the cost of more DNS/TLS surface.

### TLS options

| Option | Notes |
|--------|--------|
| **ALB / NLB** | Terminate HTTPS at AWS; forward **HTTP** to the instance on port **80** (edge nginx). One ACM certificate for `pr-preview.example.com`. |
| **nginx or Caddy on the instance** | Let’s Encrypt or imported certs; listen on **443** and proxy to loopback stacks (same path stripping as the repo’s edge sample). |

### Edge nginx (in-repo sample)

One-time on the preview host:

1. Copy [infra/preview/edge/](../infra/preview/edge/) to e.g. `~/preview-edge/` (so `docker-compose.yml` and `snippets/` sit together).
2. `docker compose -f ~/preview-edge/docker-compose.yml up -d`  
   Uses **host networking** (`network_mode: host`) so nginx can `proxy_pass` to `127.0.0.1:<port>` where each PR stack listens.

Deploys run [scripts/preview-edge-write-snippet.sh](../scripts/preview-edge-write-snippet.sh) to add `~/preview-edge/snippets/pr-<N>.conf` and reload the edge container. PR close runs [scripts/preview-edge-remove-snippet.sh](../scripts/preview-edge-remove-snippet.sh) when **`PREVIEW_PUBLIC_ORIGIN`** is configured.

Health check: `GET http://<host>/_preview-edge-health` → `200 ok`.

## Authentication

- **Email + password** (preview only): `POST /api/auth/feature-preview-password` (disabled unless `FEATURE_PREVIEW_AUTH_ENABLED=true`).
- Seeded users get a **shared** scrypt hash when `PREVIEW_SEED_PASSWORD` is set during [seed-e2e-data.js](../scripts/seed-e2e-data.js) (same password for all seeded E2E accounts in that environment).
- **Google Sign-In** remains available if configured in the build; reviewers can use preview password without Google.

## Local / manual run

1. Copy [.env.preview.example](../.env.preview.example) to `.env.preview` and set `PREVIEW_SEED_PASSWORD`.
2. `npm run preview:compose:up`
3. Open `http://127.0.0.1:8080` and sign in with a seeded email (e.g. `e2e.admin@example.com`) and the shared password.

## CI deploy (GitHub Actions)

Workflows:

- [.github/workflows/pr-preview-deploy.yml](../.github/workflows/pr-preview-deploy.yml) — on PR sync, rsyncs sources to the host and runs `docker compose -p pr-<number> ... up -d --build`.
- [.github/workflows/pr-preview-teardown.yml](../.github/workflows/pr-preview-teardown.yml) — on PR close, `docker compose ... down -v` and removes the edge path snippet when using path-based preview.
- [.github/workflows/pr-preview-reconcile.yml](../.github/workflows/pr-preview-reconcile.yml) — `workflow_dispatch` only; redeploys open PRs after downtime.

**GitHub Environment `preview`** should define:

| Secret / variable | Purpose |
|-------------------|---------|
| `PREVIEW_SSH_HOST` | Hostname or IP of the Docker host |
| `PREVIEW_SSH_KEY` | Private key for SSH |
| `PREVIEW_SEED_PASSWORD` | Shared preview password (written to remote `.env.preview`) |
| `PREVIEW_SSH_USER` (optional) | SSH user (default `ubuntu`) |
| `PREVIEW_REMOTE_REPO_DIR` (var, optional) | Remote directory for synced sources (default `/home/<user>/preview/EquipTrack` on the server) |
| `PREVIEW_PUBLIC_ORIGIN` (var, optional) | Public origin for path-based preview, e.g. `https://pr-preview.example.com` (no path). Unset keeps local-style same-origin stacks on loopback ports only. |
| `PREVIEW_HOST_PORT_BASE` (var, optional) | Defaults to `30000`; host port = `PREVIEW_HOST_PORT_BASE + PR_NUMBER`. |

Optional helper scripts (for custom automation): [scripts/preview-remote-deploy.sh](../scripts/preview-remote-deploy.sh), [scripts/preview-remote-teardown.sh](../scripts/preview-remote-teardown.sh).

## Stopped EC2 / host unreachable (by design)

Preview deploy and teardown **do not fail CI** if SSH to the preview host fails (instance stopped, security group, or network). The job **succeeds** with a **notice** in the log: deploy/teardown was skipped.

After you **start** the instance again, previews are not updated until each PR gets a new push **or** you run reconcile (below). Normal PR updates already trigger [.github/workflows/pr-preview-deploy.yml](../.github/workflows/pr-preview-deploy.yml).

## Redeploy all open PRs after a restart (manual only)

Workflow [.github/workflows/pr-preview-reconcile.yml](../.github/workflows/pr-preview-reconcile.yml) is **`workflow_dispatch` only** (no cron): it lists open PRs targeting **`main` or `develop`**, checks out each head ref, and runs the same sync + `docker compose` as a normal preview deploy.

**Suggested routine:** run [.github/workflows/pr-preview-ec2-power.yml](../.github/workflows/pr-preview-ec2-power.yml) with **start** — it waits for the instance and SSH, then **dispatches reconcile automatically**. You can still run **PR preview reconcile** manually anytime.

Shared script: [scripts/preview-gha-deploy.sh](../scripts/preview-gha-deploy.sh).

## Start/stop the preview EC2 without the AWS console (optional)

Workflow [.github/workflows/pr-preview-ec2-power.yml](../.github/workflows/pr-preview-ec2-power.yml) uses **`workflow_dispatch`** so you can run it from the **GitHub mobile app** (Actions → select workflow → Run workflow → choose **start** or **stop**).

Add these **preview** environment secrets:

| Secret | Purpose |
|--------|---------|
| `PREVIEW_AWS_ACCESS_KEY_ID` | IAM user access key (minimal policy below) |
| `PREVIEW_AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `PREVIEW_EC2_INSTANCE_ID` | e.g. `i-0123456789abcdef0` |

The workflow uses **`il-central-1`**; change the region in the YAML file if your instance is elsewhere.

**Example IAM policy** (scope `Resource` to your instance ARN):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ec2:StartInstances", "ec2:StopInstances", "ec2:DescribeInstances"],
      "Resource": "arn:aws:ec2:il-central-1:ACCOUNT_ID:instance/INSTANCE_ID"
    }
  ]
}
```

Do **not** reuse broad production credentials; use a dedicated IAM user for this.

Use **GitHub Environment protection rules** (e.g. required reviewers) on `preview` if only some people should start/stop the instance.

## Orphan cleanup

If a workflow fails after `up`, stacks may linger. Options:

- Re-run teardown workflow manually, or SSH and `docker compose -p pr-<N> -f docker-compose.preview.yml down -v`.
- Optional: [scripts/preview-sweeper.sh](../scripts/preview-sweeper.sh) (requires a PR→project map file and `gh` on the host)—documented for advanced setups.

## Security boundaries

- Previews are **not** production: isolate the host in a **separate VPC/security group** from prod; no prod credentials on the box.
- `PREVIEW_SEED_PASSWORD` and SSH keys live in **GitHub Environments** or your secret store—never in the repo.
- LocalStack data is **per compose project**; `down -v` removes volumes.
- Rate limiting is not implemented in-app for preview; rely on network-level controls if exposed publicly.

## Fidelity note

LocalStack behavior can differ from real AWS (IAM, throttling, edge cases). For **production-parity** previews you would need real AWS resources or a shared non-prod stage—not this stack.
