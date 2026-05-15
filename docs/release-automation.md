# Release Automation Runbook

This document describes how to operate and harden the fully automated release pipeline.

## Pipeline workflows

- `.github/workflows/release-orchestrator.yml`
- `.github/workflows/release-failure-remediation.yml`
- `.github/workflows/deploy-fullstack.yml`
- `.github/workflows/e2e-localstack-full-regression.yml`
- `.github/workflows/e2e-deployed-core-regression.yml`
- `.github/workflows/e2e-deployed-after-release-deploy.yml`
- `.github/workflows/e2e-deployed-after-production-deploy.yml`

## Required protections

1. Protect branches:
   - `develop`
   - `master`
   - `release/*`
2. Require status checks on `release/*` and `master`.
3. Configure environment rules:
   - `development`: no manual approval
   - `release`: optional approval
   - `production`: required reviewer, prevent self-review

## Required variables and secrets

Repository variables:

- `E2E_RELEASE_FRONTEND_URL`
- `E2E_RELEASE_BACKEND_URL`
- `E2E_PROD_FRONTEND_URL`
- `E2E_PROD_BACKEND_URL`

Environment secrets (all stages):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `API_GATEWAY_REGIONAL_CERTIFICATE_ARN`
- `E2E_AUTH_SECRET`

## Normal release procedure

1. Trigger **Release Orchestrator**:
   - `release_version`: `x.y.z`
   - `max_fix_attempts`: recommended `2`
   - `dry_run`: `false`
2. Monitor release summary in workflow output.
3. Confirm the following outcomes:
   - beta deployment succeeded,
   - release test gates passed,
   - production deployment succeeded,
   - production test gates passed,
   - merge-back to `develop` completed.

## Failure drills (quarterly)

1. **Release gate failure drill**
   - Intentionally break one release e2e test.
   - Confirm `release-failure-remediation.yml` opens a remediation issue and waits for PR.
   - Confirm PR must pass checks and approval before merge.
2. **Deploy failure drill**
   - Introduce a temporary deploy-script failure.
   - Confirm orchestrator stops before production tag creation.
3. **Escalation drill**
   - Set `max_fix_attempts=1` and keep test failing.
   - Confirm workflow exits with explicit escalation message.

## Operational guardrails

- Never bypass production environment protections.
- Keep auto-merge enabled only on remediation PRs with `cursor-auto-fix` label.
- Prefer smallest possible remediation PR to limit blast radius.
- Use stable retag rollback only from known-good commit history.
