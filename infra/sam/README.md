# EquipTrack API — AWS SAM (infrastructure as code)

This directory holds a [SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html) template that models the **REST API topology**: API Gateway stage, routes, `AWS_PROXY` integrations to the existing per-handler Lambda functions, and `AWS::Lambda::Permission` resources so API Gateway can invoke them.

It is the single reviewed source for **which paths and methods exist** and **which Lambda function name** each route uses (`equip-track-<handlerKey>-<Stage>`, matching `scripts/deploy-api-gateway.js` and `scripts/deploy-lambdas.js`).

## Generate the template

The OpenAPI `DefinitionBody` is **generated** from `libs/shared/src/api/endpoints.ts` so it cannot drift from the shared API contract:

```bash
npm run generate:sam
```

Commit the updated `template.yaml` whenever endpoints change.

## Validate locally

After `npm ci` (for `ts-node`):

```bash
npm run generate:sam
sam validate --lint --template infra/sam/template.yaml
```

On CI, use `aws-actions/setup-sam` (see `.github/workflows/sam-validate.yml`).

## Deploy (phased migration)

**Today:** Production still provisions the API with `scripts/deploy-api-gateway.js`. The SAM template is validated in CI and documents the intended topology.

**First-time SAM deploy (when you cut over):**

1. Copy `samconfig.toml.example` to `samconfig.toml` and adjust `stack_name`, `region`, and `Stage`.
2. Ensure all Lambdas already exist (`deploy-lambdas.js`) with the same names as in the template.
3. Run `sam deploy --guided` once, then use non-interactive deploy in your infra pipeline.

**Custom domains** (`dev-api.equip-track.com`, `api.equip-track.com`) remain managed by `scripts/setup-api-custom-domain.js` / existing runbooks until you model `AWS::ApiGateway::DomainName` and base path mappings in SAM (or a separate stack).

**`RECREATE_API` / stack replace:** Document a runbook before switching: mapping custom domain to a new REST API ID, updating `deployment-info.json`, and avoiding duplicate APIs named `equip-track-api-<Stage>`.

## Routine application deploys

Unchanged from today: CI continues to run `update-function-code` for Lambdas when only backend code changes and API routes are unchanged. SAM is the **declarative reference** for when an infra deploy is required (template or `libs/shared/src/api` changes).
