# EquipTrack Environment Variables

This document describes all environment variables used across the EquipTrack deployment scripts.

## Required Environment Variables

### AWS Configuration
- `AWS_ACCESS_KEY_ID` - AWS access key (can be set via AWS CLI profile instead)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key (can be set via AWS CLI profile instead)
- `AWS_SESSION_TOKEN` - AWS session token (only needed for temporary credentials)
- `AWS_REGION` - AWS region for all resources (default: 'us-east-1')

### Deployment Configuration
- `STAGE` - Deployment stage/environment (default: 'dev' for most scripts, 'production' for prepare-deployment)

## Optional Environment Variables

### Security Configuration
- `ALLOWED_IPS` - Comma-separated list of IP ranges for S3 bucket access restriction
- `API_THROTTLE_RATE` - API Gateway throttling rate limit (requests per second)
- `API_THROTTLE_BURST` - API Gateway burst limit

### Lambda Configuration
- `LAMBDA_RUNTIME` - Lambda runtime version (default: 'nodejs20.x')
- `LAMBDA_TIMEOUT` - Lambda timeout in seconds (default: 30)
- `LAMBDA_MEMORY_SIZE` - Lambda memory allocation in MB (default: 256)

### CloudFront Configuration
- `CLOUDFRONT_PRICE_CLASS` - CloudFront price class (default: 'PriceClass_100')
- `SKIP_CLOUDFRONT` - Skip CloudFront setup for faster dev deployments (default: false)

### Caching Configuration
- `FRONTEND_CACHE_MAX_AGE` - Cache max age for frontend assets (default: 31536000 seconds)
- `FRONTEND_INDEX_CACHE_CONTROL` - Cache control for index.html (default: 'no-cache,no-store,must-revalidate')

### Database Configuration
- `DYNAMODB_BILLING_MODE` - DynamoDB billing mode (default: 'PAY_PER_REQUEST')

### Development Settings
- `VERBOSE_LOGGING` - Enable verbose logging during deployment (default: false)
- `REUSE_EXISTING_RESOURCES` - Try to reuse existing AWS resources when possible (default: true)

## Usage Examples

### Basic Development Setup
```bash
export STAGE=dev
export AWS_REGION=us-east-1
export AWS_PROFILE=my-aws-profile
```

### Production Setup
```bash
export STAGE=production
export AWS_REGION=us-west-2
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
```

### Custom Configuration
```bash
export STAGE=staging
export AWS_REGION=eu-west-1
export LAMBDA_TIMEOUT=60
export LAMBDA_MEMORY_SIZE=512
export CLOUDFRONT_PRICE_CLASS=PriceClass_All
```

## Security Notes

1. **Never commit AWS credentials** to version control
2. **Use IAM roles** when possible instead of access keys
3. **Restrict S3 bucket access** using ALLOWED_IPS in production
4. **Use least-privilege policies** for Lambda roles
5. **Enable API throttling** to prevent abuse
6. **Use environment-specific resource naming** to isolate stages 