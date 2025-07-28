# AWS Full Stack Deployment Setup

This document explains how to set up AWS deployment for the complete EquipTrack application (backend + frontend) using GitHub Actions.

## Overview

The deployment process automatically:

1. **Builds** the backend using Nx
2. **Builds** the frontend (Angular) using Nx  
3. **Creates** individual Lambda deployment packages for each API handler
4. **Deploys** Lambda functions to AWS
5. **Sets up** API Gateway with proper routing
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

Attach the following AWS managed policies to the user:

- **AWSLambdaFullAccess** - For Lambda function management
- **AmazonAPIGatewayAdministrator** - For API Gateway management  
- **AmazonDynamoDBFullAccess** - For DynamoDB table management
- **AmazonS3FullAccess** - For S3 bucket and static website hosting
- **CloudFrontFullAccess** - For CloudFront CDN management
- **IAMFullAccess** - For creating Lambda execution roles

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

## Deployment Configuration

### Environment Variables

The deployment uses these environment variables (set in the workflow):

- `AWS_REGION`: AWS region for deployment (default: us-east-1)
- `STAGE`: Deployment stage (default: production)

### Customizing Deployment

You can customize the deployment by editing:

- **`.github/workflows/deploy-fullstack.yml`** - GitHub Actions workflow
- **`scripts/deploy-lambdas.js`** - Lambda configuration (timeout, memory, etc.)
- **`scripts/deploy-api-gateway.js`** - API Gateway settings
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
- REST API: `equip-track-api-production`
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
node scripts/deploy-api-gateway.js

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
deploy-api-gateway.js     →  reads endpoints-config.json, updates deployment-info.json
deploy-frontend.js        →  updates deployment-info.json
setup-cloudfront.js       →  updates deployment-info.json
```

### Benefits
- ✅ **Single Source of Truth**: All scripts use same endpoint definitions
- ✅ **Clear Dependencies**: Explicit file-based configuration
- ✅ **Deployment Tracking**: Structured status monitoring
- ✅ **CI/CD Resilient**: Fallback to hardcoded definitions when needed
- ✅ **Easy Debugging**: JSON files can be inspected manually

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure your IAM user has all required policies
2. **Role Creation Failed**: The Lambda role might already exist or need time to propagate
3. **API Gateway Errors**: Check that Lambda functions were deployed successfully first
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

# Delete API Gateway (replace with your API ID)
aws apigateway delete-rest-api --rest-api-id YOUR_API_ID

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