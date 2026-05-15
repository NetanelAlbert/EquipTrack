# PR preview via GitHub webhook (no SSH from Actions)

PR **open/sync** and **close** are handled by a small **Node** listener on the preview host. GitHub sends signed `pull_request` deliveries to your public URL; the host **git fetches** the PR branch (public repo) and runs the same compose deploy/teardown scripts as before.

## Why

If the instance security group allows **SSH only from your IP**, GitHub-hosted runners cannot connect. A **webhook** only needs **inbound HTTPS** to paths you expose behind the ALB (same as the app).

## One-time setup on the preview host

1. **Clone** the repo once (or let the first webhook run create it):

   ```bash
   sudo mkdir -p /etc/equiptrack
   sudo install -m 600 /dev/stdin /etc/equiptrack/preview-webhook.env <<'EOF'
   GITHUB_WEBHOOK_SECRET=generate-a-long-random-secret
   PREVIEW_SEED_PASSWORD=your-preview-shared-password
   PREVIEW_PUBLIC_ORIGIN=https://pr-preview.equip-track.com
   PREVIEW_REMOTE_REPO_DIR=/home/ubuntu/preview/EquipTrack
   PREVIEW_GIT_REMOTE_URL=https://github.com/NetanelAlbert/EquipTrack.git
   PREVIEW_WEBHOOK_LOG=/var/log/preview-github-webhook.log
   EOF
   ```

   Adjust `PREVIEW_REMOTE_REPO_DIR` and user in the systemd unit if needed.

2. **Install Node.js** (20+) if not present (`nodejs` package or NodeSource).

3. **Copy** [infra/systemd/preview-github-webhook.service](../infra/systemd/preview-github-webhook.service) to `/etc/systemd/system/`, fix `User=` and `ExecStart` paths to match your layout, then:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now preview-github-webhook.service
   ```

4. **Edge nginx** must proxy `/webhooks/github/preview` to `127.0.0.1:9090` (see [infra/preview/edge/nginx.conf](../infra/preview/edge/nginx.conf)). Reload edge after updating.

5. **GitHub** → **Settings** → **Webhooks** → **Add webhook**  
   - **Payload URL:** `https://pr-preview.equip-track.com/webhooks/github/preview`  
   - **Content type:** `application/json`  
   - **Secret:** same value as `GITHUB_WEBHOOK_SECRET`  
   - **Events:** “Let me select individual events” → enable **Pull requests** only  

6. **Redeliver** a test event or open a test PR to verify. Check `/var/log/preview-github-webhook.log` if configured.

## Behavior

| GitHub `action` | Host behavior |
|-----------------|---------------|
| `opened`, `synchronize`, `reopened`, `ready_for_review` (non-draft, base `main`/`develop`) | `git fetch` PR head → [scripts/preview-deploy-local.sh](../scripts/preview-deploy-local.sh) |
| `closed` | [scripts/preview-teardown-local.sh](../scripts/preview-teardown-local.sh) |

Draft PRs are ignored for deploy.

## GitHub Actions

Automated **pr-preview-deploy** / **pr-preview-teardown** workflows are **disabled** (webhook replaces them). Use [pr-preview-reconcile.yml](../.github/workflows/pr-preview-reconcile.yml) only if you still use **SSH** to bulk-redeploy after downtime; otherwise redeploy by pushing to PRs or redeliver webhooks.

## Security

- Always set a strong **`GITHUB_WEBHOOK_SECRET`** and verify the **same** value in GitHub webhook settings (HMAC SHA-256).
- The listener binds **`127.0.0.1:9090`** only; do not expose it directly to the internet without the edge/ALB in front.
- Optional: restrict webhook path in WAF or add IP allowlists for GitHub hook ranges (extra maintenance).
