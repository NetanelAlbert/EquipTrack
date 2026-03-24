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
- **Optional (when GitHub secrets are set)** — custom domain name, base path mapping, Route53 alias (see below).

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
| `API_GATEWAY_REGIONAL_CERTIFICATE_ARN` | ACM certificate ARN in the **same region as the API** (e.g. `il-central-1`) for `dev-api.*` / `api.*`. If unset, SAM skips custom domain resources and `setup-api-custom-domain.js` runs after deploy (ACM lookup + mapping + DNS as today). |
| `ROUTE53_HOSTED_ZONE_ID` | Hosted zone ID for the apex domain (e.g. `equip-track.com`). If set together with the cert, SAM creates the API **Route53 alias** record. If unset while cert is set, add the alias manually to the API Gateway regional domain. |

Override hostname: set env `API_HOSTNAME` in the workflow or locally.

## Legacy API cleanup (opt-in, destructive)

**Default: off.** When **`PRUNE_LEGACY_API_GATEWAY=true`** and the CloudFormation stack **`equip-track-api-stack-<Stage>`** does not exist yet, `deploy-sam-api.js` **permanently deletes** every REST API named **`equip-track-api-<Stage>`** in the current account/region and removes base path mappings on the configured API hostname that point at those APIs.

Use only as a **go-live checklist** item: confirm **account ID**, **region**, **`STAGE`**, and that those APIs are really the legacy ones. In GitHub Actions, set a repository or environment variable `PRUNE_LEGACY_API_GATEWAY=true` for the cutover run, then remove or set it back to false.

## Troubleshooting

- **`AlreadyExistsException` for custom domain** — An API Gateway domain name for that hostname exists outside this stack. Delete it in the API Gateway console (or leave the cert secret empty so only `setup-api-custom-domain.js` manages the domain).
- **`sam deploy` IAM errors** — Ensure deploy credentials allow CloudFormation, API Gateway, Lambda (pass role / permissions), S3 (packaging bucket), and Route53 if using `HostedZoneId`.

## Deprecated

`scripts/deploy-api-gateway.js` is **deprecated**; use `deploy-sam-api.js` and this template.
