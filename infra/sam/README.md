# EquipTrack API — AWS SAM

The REST API is deployed with **AWS SAM** / CloudFormation. The template is **generated** from `libs/shared/src/api/endpoints.ts` so routes match the shared contract.

## Regenerate the template

```bash
npm run generate:sam
```

Commit `infra/sam/template.yaml` when endpoints change.

## What gets deployed

- **REST API** `equip-track-api-<Stage>` (regional), stage name = `Stage` (`dev` | `production`).
- **Routes** — OpenAPI `aws_proxy` to existing Lambdas `equip-track-<handlerKey>-<Stage>` (created by `deploy-lambdas.js`).
- **`AWS::Lambda::Permission`** — API Gateway → Lambda invoke on this API.
- **Optional (when `API_GATEWAY_REGIONAL_CERTIFICATE_ARN` is set)** — `AWS::ApiGateway::DomainName` + `BasePathMapping` for the stage hostname (`dev-api.*` / `api.*` by default).

**DNS** is **not** created in CloudFormation (avoids conflicts with existing A records). After every successful `sam deploy`, `scripts/setup-api-custom-domain.js` runs to **UPSERT** the Route53 alias and reconcile the base path mapping.

**CloudFormation stack name:** `equip-track-api-stack-<Stage>`.

## CI / full stack deploy

Release workflow runs `node scripts/deploy-sam-api.js` after Lambdas are updated. SAM CLI is installed via `aws-actions/setup-sam`.

## Local / manual deploy

```bash
export STAGE=dev
export AWS_REGION=il-central-1
npm ci
node scripts/prepare-deployment.js
npx nx build backend --configuration=development   # or production
node scripts/create-lambda-packages.js
node scripts/deploy-lambdas.js
node scripts/deploy-sam-api.js
```

Optional: copy `samconfig.toml.example` to `samconfig.toml` and use `sam deploy` yourself with the same parameters as `deploy-sam-api.js`.

## GitHub secrets (per environment)

| Secret | Purpose |
|--------|---------|
| `API_GATEWAY_REGIONAL_CERTIFICATE_ARN` | ACM certificate ARN in the **same region as the API** (e.g. `il-central-1`) for `dev-api.*` / `api.*`. If unset, SAM skips custom domain resources; `setup-api-custom-domain.js` still runs after deploy (ACM lookup + mapping + DNS). |

Override hostname: set env `API_HOSTNAME` in the workflow or locally.

## Legacy API cleanup (opt-in, destructive)

**Default: off.** When **`PRUNE_LEGACY_API_GATEWAY=true`** and the CloudFormation stack **`equip-track-api-stack-<Stage>`** does not exist yet, `deploy-sam-api.js` **permanently deletes** every REST API named **`equip-track-api-<Stage>`** in the current account/region and removes base path mappings on the configured API hostname that point at those APIs.

Use only as a **go-live checklist** item: confirm **account ID**, **region**, **`STAGE`**, and that those APIs are really the legacy ones. In GitHub Actions, set a repository or environment variable `PRUNE_LEGACY_API_GATEWAY=true` for the cutover run, then remove or set it back to false.

## Troubleshooting

- **`AlreadyExistsException` for custom domain** — An API Gateway domain name for that hostname exists outside this stack. Delete it in the API Gateway console (or leave the cert secret empty so only `setup-api-custom-domain.js` manages the domain).
- **`Invalid stage identifier` on BasePathMapping** — Fixed in template by depending on SAM’s `EquipTrackApiStage`; regenerate and redeploy.
- **Stack stuck in `ROLLBACK_COMPLETE`** — Delete the stack `equip-track-api-stack-<Stage>` in CloudFormation, then re-run deploy (the deploy script will fail fast with instructions if it detects this state).
- **`sam deploy` IAM errors** — Ensure deploy credentials allow CloudFormation, API Gateway, Lambda (pass role / permissions), S3 (packaging bucket), and Route53 (used by `setup-api-custom-domain.js`).

## Deprecated

`scripts/deploy-api-gateway.js` is **deprecated**; use `deploy-sam-api.js` and this template.
