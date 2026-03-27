# Agent instructions

Guidance for autonomous coding agents working in this repository.

## Cursor Cloud specific instructions

This repository defines a [Cloud Agent environment](https://cursor.com/docs/cloud-agent/setup) in `.cursor/environment.json`: the VM image includes Docker (fuse-overlayfs storage driver) and on each session start runs LocalStack from `docker-compose.e2e.yml` (port **4566**).

- **AWS emulated endpoint**: `http://localhost:4566` (same as local E2E; see `docs/local-e2e.md`).
- **Bring up / reprovision LocalStack** (idempotent): `npm run e2e:local:stack:up` or `docker compose -f docker-compose.e2e.yml up -d --wait localstack`.
- **Seed DynamoDB, S3, Secrets Manager** after LocalStack is healthy: `npm run e2e:local:setup` (uses `AWS_ENDPOINT_URL` / test credentials like local E2E).
- **Full local E2E stack** (LocalStack + seed + browsers + tests): see `docs/local-e2e.md` and scripts under `npm run e2e:local:*`.

If Docker or LocalStack fails inside a nested container, follow Cursor’s [Running Docker](https://cursor.com/docs/cloud-agent/setup#running-docker) troubleshooting (storage driver / iptables).

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
