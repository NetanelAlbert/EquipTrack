# AWS Full Stack Deployment Setup

This document explains how to set up AWS deployment for the complete EquipTrack application (backend + frontend) using GitHub Actions.

## Overview

The deployment process automatically:

1. **Builds** the backend using Nx
2. **Builds** the frontend (Angular) using Nx  
3. **Creates** individual Lambda deployment packages for each API handler
4. **Deploys** Lambda functions to AWS
5. **Deploys** the REST API via **AWS SAM** (CloudFormation stack `equip-track-api-stack-<stage>`) and reconciles custom domain / Route53
6. **Creates** DynamoDB tables if they don't exist
7. **Deploys** frontend to S3 with static website hosting
8. **Sets up** CloudFront CDN for global distribution and HTTPS

## Required GitHub Secrets

You need to add the following secrets to your GitHub repository:

### 1. AWS_ACCESS_KEY_ID
Your AWS access key ID for programmatic access.

### 2. AWS_SECRET_ACCESS_KEY  
Your AWS secret access key for programmatic access.

## Setting up AWS Credentials

### Step 1: Create an IAM User

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **"Users"** → **"Create user"**
3. User name: `equiptrack-github-deploy`
4. Select **"Programmatic access"**

### Step 2: Attach Required Policies

Attach policies that cover the resources below (exact managed policy names can be replaced with tighter custom policies in production):

- **AWSLambdaFullAccess** — Lambda function management
- **AmazonAPIGatewayAdministrator** — API Gateway (REST API, custom domains, base path mappings)
- **AmazonDynamoDBFullAccess** — DynamoDB tables
- **AmazonS3FullAccess** — Frontend buckets and **SAM CLI** packaging uploads (`sam deploy --resolve-s3` uses a managed artifacts bucket in the account)
- **CloudFrontFullAccess** — CloudFront CDN
- **IAMFullAccess** — Lambda execution roles (consider narrowing to PassRole + role/policy edits for `equip-track-lambda-role-*` only)
- **AWSCloudFormationFullAccess** — **Required for SAM**: creates/updates stack `equip-track-api-stack-<stage>`
- **AmazonRoute53FullAccess** (or a zone-scoped policy) — If `setup-api-custom-domain.js` upserts **Route53** alias records for the API hostname

### Step 3: Get Access Keys

1. After creating the user, click **"Create access key"**
2. Choose **"Third-party service"** 
3. Save the **Access Key ID** and **Secret Access Key**

### Step 4: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add:

   **Name:** `AWS_ACCESS_KEY_ID`  
   **Value:** Your access key ID

   **Name:** `AWS_SECRET_ACCESS_KEY`  
   **Value:** Your secret access key

For **environment-scoped** secrets (recommended), use **Settings → Environments** (`development` / `production`) as in **`docs/github-environments-setup.md`**.

### API custom domain (per environment, optional but typical)

Used by **SAM** (`infra/sam`) and **`setup-api-custom-domain.js`**:

| Secret | Purpose |
|--------|---------|
| `API_GATEWAY_REGIONAL_CERTIFICATE_ARN` | ACM certificate ARN in the **same region as the API** (e.g. `il-central-1`) for `dev-api.*` / `api.*`. If unset, SAM skips in-stack custom domain resources; the post-deploy script still reconciles mapping + Route53 when possible. |

See **`infra/sam/README.md`** for stack names, DNS behavior, and optional **`PRUNE_LEGACY_API_GATEWAY`**.

## Deployment Configuration

### Environment Variables

The deployment uses these environment variables (set in the workflow):

- `AWS_REGION`: Set in **`.github/workflows/deploy-fullstack.yml`** (currently **`il-central-1`**)
- `STAGE`: **`dev`** for prerelease tags, **`production`** for stable release tags (derived in the workflow from the tag)

### Customizing Deployment

You can customize the deployment by editing:

- **`.github/workflows/deploy-fullstack.yml`** - GitHub Actions workflow
- **`scripts/deploy-lambdas.js`** - Lambda configuration (timeout, memory, etc.)
- **`infra/sam/template.yaml`** + **`scripts/deploy-sam-api.js`** - API Gateway (SAM / CloudFormation)
- **`scripts/deploy-frontend.js`** - S3 and frontend configuration
- **`scripts/setup-cloudfront.js`** - CloudFront CDN settings

### Changing AWS Region

To deploy to a different region, update the `AWS_REGION` environment variable in `.github/workflows/deploy-fullstack.yml`:

```yaml
env:
  AWS_REGION: us-west-2  # Change to your preferred region
```

## Deployed Resources

The deployment creates the following AWS resources:

### Backend Resources

#### Lambda Functions
- One function per API handler (e.g., `equip-track-getUsers-production`)
- Runtime: Node.js 20.x
- Timeout: 30 seconds
- Memory: 256 MB

#### IAM Role
- `equip-track-lambda-role-production` with necessary permissions

#### API Gateway
- REST API: `equip-track-api-production` (deployed via SAM stack `equip-track-api-stack-production`)
- Stage: `production` (or your configured stage)
- All endpoints configured with Lambda proxy integration

#### DynamoDB Tables
- `UsersAndOrganizations`
- `Inventory`  
- `Forms`
- `Reports`

### Frontend Resources

#### S3 Bucket
- Bucket name: `equip-track-frontend-production`
- Configured for static website hosting
- Public read access for web content
- Optimized cache headers for performance

#### CloudFront Distribution
- Global CDN with HTTPS/HTTP2 support
- Custom error pages for SPA routing (404 → index.html)
- Compression enabled for optimal performance
- Cache policies optimized for Angular apps

## Testing the Deployment

After successful deployment, the workflow will output both URLs:

```
API deployed to: https://[api-id].execute-api.us-east-1.amazonaws.com/production
Frontend deployed to: https://[cloudfront-id].cloudfront.net
```

### Testing the Frontend
- Open the CloudFront URL in your browser
- Your Angular application should load with HTTPS
- SPA routing should work correctly (e.g., refreshing on a route shouldn't show 404)

### Testing the API
- Use the API URL with your existing endpoints
- CORS should be properly configured for your frontend domain

## Frontend Configuration

The deployment automatically configures your Angular frontend to use the deployed API:

### Environment Configuration
- **Development**: Uses `http://localhost:3000` (local backend)
- **Production**: Automatically configured with deployed API URL during build

### Automatic API URL Configuration
The deployment process:
1. Deploys the backend API and gets the API Gateway URL
2. Builds the frontend with production configuration
3. Replaces the API URL placeholder with the actual deployed URL
4. Uploads the configured frontend to S3

### Using the API Service
A basic API service is provided at `apps/frontend/src/services/api.service.ts` that automatically uses the correct environment configuration:

```typescript
import { ApiService } from '../services/api.service';

// In your component or service
constructor(private apiService: ApiService) {}

// Make API calls
this.apiService.get('/api/organizations/123/users').subscribe(users => {
  console.log(users);
});
```

### Manual Deployment (Development)
For manual deployment or testing individual scripts:

```bash
# 1. Always run prepare script first
node scripts/prepare-deployment.js

# 2. Then run other scripts in sequence
npx nx build backend --configuration=production
node scripts/create-lambda-packages.js
node scripts/deploy-lambdas.js
node scripts/deploy-sam-api.js

npx nx build frontend --configuration=production  
node scripts/deploy-frontend.js
node scripts/setup-cloudfront.js
```

### Manual Configuration (if needed)
If you need to update the API URL manually:

1. Update `apps/frontend/src/environments/environment.prod.ts`
2. Replace `'API_URL_PLACEHOLDER'` with your API URL
3. Rebuild and redeploy the frontend

## Deployment Scripts Architecture

The deployment uses a **prepare-first** architecture with centralized configuration:

### Deployment Preparation Script
The `scripts/prepare-deployment.js` script runs first and:

1. **Loads Endpoints**: Attempts built files first, falls back to hardcoded definitions
2. **Creates `endpoints-config.json`**: Centralized endpoint configuration for all scripts
3. **Initializes `deployment-info.json`**: Structured deployment tracking with status

### Configuration Files
- **`endpoints-config.json`**: Contains all API endpoint definitions and handler names
- **`deployment-info.json`**: Tracks deployment status across backend/frontend components

### Script Dependencies
```
prepare-deployment.js  →  endpoints-config.json
                      →  deployment-info.json

create-lambda-packages.js  →  reads endpoints-config.json
deploy-lambdas.js         →  updates deployment-info.json
deploy-sam-api.js         →  sam build/deploy, updates deployment-info.json (optional setup-api-custom-domain.js); optional opt-in legacy API prune via PRUNE_LEGACY_API_GATEWAY=true
deploy-frontend.js        →  updates deployment-info.json
setup-cloudfront.js       →  updates deployment-info.json
```

### Benefits
- ✅ **Single Source of Truth**: All scripts use same endpoint definitions
- ✅ **Clear Dependencies**: Explicit file-based configuration
- ✅ **Deployment Tracking**: Structured status monitoring
- ✅ **CI/CD Resilient**: Fallback to hardcoded definitions when needed
- ✅ **Easy Debugging**: JSON files can be inspected manually

## Release to production (develop → master)

This section summarizes what **develop** has hardened for **SAM-based API deploys** so you can merge to **`master`** and cut a **stable** release tag with confidence.

### How production is targeted

- Workflow: **`.github/workflows/deploy-fullstack.yml`** runs on **`push` of tags** `v*`.
- **Pre-release tags** (semver prerelease, e.g. `v1.2.3-beta.0`) deploy to **`STAGE=dev`** and GitHub Environment **`development`**.
- **Stable tags** (e.g. `v1.2.3` with **no** prerelease segment) deploy to **`STAGE=production`** and GitHub Environment **`production`**.

Concurrency is **per AWS stage** (not per tag), so two prerelease tags cannot race the same dev buckets/API.

### Pre-merge checklist

1. **Green develop pipeline** — Recent pre-release deploy (e.g. `v0.0.12-beta.x`) completed successfully, including **Deploy API (AWS SAM)** and **`setup-api-custom-domain.js`**.
2. **SAM template CI** — **SAM API template** workflow passes (regenerate + `sam validate --lint` on `infra/sam/template.yaml`).
3. **Production environment secrets** — In GitHub **Settings → Environments → production**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and usually **`API_GATEWAY_REGIONAL_CERTIFICATE_ARN`** for `api.<your-domain>` in **`il-central-1`**. Add **`E2E_AUTH_SECRET`** if you run deployed Playwright against production.
4. **IAM** — Deploy principal allows **CloudFormation**, **API Gateway**, **Lambda**, **S3** (including SAM artifact uploads), **IAM** PassRole for Lambda roles, and **Route53** if API DNS is managed in Route53 (see policies above).

### First stable tag after SAM (production account)

1. Merge **`develop`** into **`master`** (or your release process).
2. Create and push a **stable** version tag from the commit you intend to ship (e.g. `v1.0.0`). Your **auto-version** workflow on `master` may do this; otherwise tag manually.
3. Approve the **`production`** environment deployment if you use required reviewers.
4. **CloudFormation** creates or updates **`equip-track-api-stack-production`**. REST API name remains **`equip-track-api-production`** (same as pre-SAM scripts).
5. **Legacy REST API cleanup** — If an **old** REST API with the same name still exists outside the stack, delete it once or use a **single** cutover run with **`PRUNE_LEGACY_API_GATEWAY=true`** (see **`infra/sam/README.md`**). Default is **off** to avoid accidental deletes.
6. **Failed stack** — If a run leaves the stack in **`ROLLBACK_COMPLETE`**, delete **`equip-track-api-stack-production`** in CloudFormation and re-run the workflow once (see **`infra/sam/README.md`**).

### Rollback expectations

- Reverting a **Git** merge does **not** automatically revert **AWS**. Prefer **CloudFormation stack** history, **previous Lambda** builds, or re-tagging a known-good commit for emergency rollback.

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure your IAM user has all required policies
2. **Role Creation Failed**: The Lambda role might already exist or need time to propagate
3. **API / SAM errors**: Ensure Lambdas deployed first; check **CloudFormation** stack **`equip-track-api-stack-<stage>`** events. Empty template updates use **`--no-fail-on-empty-changeset`** (no failure). **`ROLLBACK_COMPLETE`** → delete stack and retry once.
4. **"endpoints-config.json not found"**: Run `node scripts/prepare-deployment.js` first
5. **"deployment-info.json not found"**: Run the prepare script, or check if scripts are running in correct order

### Viewing Logs

- **GitHub Actions**: Check the Actions tab in your repository
- **AWS Lambda**: View function logs in CloudWatch
- **API Gateway**: Enable CloudWatch logging for your API stage

## Security Considerations

- The deployed Lambda functions have DynamoDB full access
- API Gateway endpoints have no authentication (you may want to add API keys or Cognito)
- Consider using least-privilege IAM policies for production

## Manual Cleanup

To clean up all deployed resources:

```bash
# Set your stage (production, dev, etc.)
STAGE=production

# Delete CloudFront distribution (replace with your distribution ID)
aws cloudfront get-distribution-config --id YOUR_DISTRIBUTION_ID | jq '.DistributionConfig | .Enabled=false' > disable-dist.json
aws cloudfront update-distribution --id YOUR_DISTRIBUTION_ID --distribution-config file://disable-dist.json --if-match YOUR_ETAG
# Wait for distribution to be disabled, then:
# aws cloudfront delete-distribution --id YOUR_DISTRIBUTION_ID --if-match NEW_ETAG

# Empty and delete S3 bucket
aws s3 rm s3://equip-track-frontend-${STAGE} --recursive
aws s3api delete-bucket --bucket equip-track-frontend-${STAGE}

# Delete Lambda functions
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'equip-track-')]" --output text --query "Functions[].[FunctionName]" | xargs -I {} aws lambda delete-function --function-name {}

# Delete SAM-managed API stack (preferred)
aws cloudformation delete-stack --stack-name equip-track-api-stack-${STAGE}

# Or delete REST API only if not managed by CloudFormation (replace with your API ID)
# aws apigateway delete-rest-api --rest-api-id YOUR_API_ID

# Delete IAM role
aws iam detach-role-policy --role-name equip-track-lambda-role-${STAGE} --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam detach-role-policy --role-name equip-track-lambda-role-${STAGE} --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
aws iam delete-role --role-name equip-track-lambda-role-${STAGE}

# Note: DynamoDB tables are not automatically deleted for safety
# Delete them manually if needed:
# aws dynamodb delete-table --table-name UsersAndOrganizations
# aws dynamodb delete-table --table-name Inventory
# aws dynamodb delete-table --table-name Forms  
# aws dynamodb delete-table --table-name Reports
``` 