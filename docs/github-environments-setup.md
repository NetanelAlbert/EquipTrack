# GitHub Environments Setup Guide

This guide walks you through setting up proper environment separation for the EquipTrack deployment pipeline.

## 🎯 Overview

GitHub Environments provide:
- **Deployment Protection Rules**: Manual approvals, time delays, branch restrictions
- **Environment-Specific Secrets**: Separate AWS credentials per environment
- **Environment Variables**: Different configurations per environment
- **Deployment History**: Track deployments per environment

## 🚀 Quick Setup Instructions

### Step 1: Create Environments

1. Go to your GitHub repository
2. Click **Settings** → **Environments**
3. Click **New environment**

#### Create Development Environment
- **Name**: `development`
- **Protection Rules**: None (automatic deployment)
- **Environment Variables**:
  - `AWS_REGION`: `il-central-1`
  - `STAGE`: `dev`

#### Create Production Environment
- **Name**: `production`
- **Protection Rules**:
  - ✅ **Required reviewers**: Add yourself and team members
  - ✅ **Wait timer**: 5 minutes (optional)
  - ✅ **Deployment branches**: Only `main` branch and tags starting with `v`
- **Environment Variables**:
  - `AWS_REGION`: `il-central-1`
  - `STAGE`: `production`

### Step 2: Configure Environment Secrets

#### Development Environment Secrets
Navigate to **Settings** → **Environments** → **development** → **Environment secrets**:

- `AWS_ACCESS_KEY_ID`: Your dev AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your dev AWS secret key
- `BASE_DOMAIN`: `dev.equip-track.com` (if using custom domains)

#### Production Environment Secrets  
Navigate to **Settings** → **Environments** → **production** → **Environment secrets**:

- `AWS_ACCESS_KEY_ID`: Your production AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your production AWS secret key
- `BASE_DOMAIN`: `equip-track.com` (if using custom domains)

### Step 3: AWS IAM Setup for Environment Separation

#### Option A: Separate AWS Accounts (Recommended)
- **Development**: Separate AWS account for dev environment
- **Production**: Separate AWS account for production environment
- Complete resource isolation and security

#### Option B: Same AWS Account with IAM Separation
Create separate IAM users/roles with limited permissions:

**Development IAM Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:*",
        "cloudfront:*",
        "apigateway:*",
        "lambda:*",
        "dynamodb:*",
        "iam:PassRole",
        "iam:GetRole",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "il-central-1"
        },
        "StringLike": {
          "aws:ResourceTag/Environment": "dev"
        }
      }
    }
  ]
}
```

**Production IAM Policy**: Similar but with `"Environment": "production"` tag requirement

## 🔒 Security Best Practices

### 1. Enable Branch Protection
- **Development**: Allow `develop` branch deployments
- **Production**: Only allow `main` branch and version tags (`v*`)

### 2. Required Reviewers for Production
- Minimum 1 reviewer for production deployments
- Use teams instead of individual users when possible

### 3. OIDC Integration (Advanced - Optional)
For enhanced security, migrate from access keys to OIDC:

1. Create AWS IAM OIDC Identity Provider
2. Create environment-specific IAM roles
3. Update workflow to use `role-to-assume` instead of access keys

## 📝 Environment Variables Reference

| Variable | Development | Production |
|----------|-------------|------------|
| `AWS_REGION` | `il-central-1` | `il-central-1` |
| `STAGE` | `dev` | `production` |
| `BASE_DOMAIN` | `dev.equip-track.com` | `equip-track.com` |

## 🧪 Testing the Setup

### Development Deployment Test
1. Push to `develop` branch
2. Verify automatic deployment to development environment
3. Check that dev resources are created/updated

### Production Deployment Test
1. Create a tag: `git tag v1.0.0 && git push origin v1.0.0`
2. Verify approval request is sent
3. Approve deployment
4. Check that production resources are created/updated

## 🔧 Troubleshooting

### Common Issues

**Issue**: "Environment protection rules failed"
- **Solution**: Check required reviewers are available and branch restrictions

**Issue**: "Secrets not found"
- **Solution**: Verify secrets are set in the correct environment, not repository level

**Issue**: "IAM permissions denied"
- **Solution**: Ensure environment-specific IAM policies include required permissions

**Issue**: "Wrong AWS region/stage"
- **Solution**: Check environment variables are set correctly for each environment

## 📚 Additional Resources

- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [AWS IAM OIDC with GitHub Actions](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [Environment Protection Rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

---

## ✅ Verification Checklist

After setup, verify:
- [ ] Development environment deploys automatically
- [ ] Production environment requires approval
- [ ] Environment-specific secrets are isolated
- [ ] Correct AWS resources are targeted per environment
- [ ] Deployment history is tracked separately per environment 