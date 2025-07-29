#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';

function checkCommand(command, name) {
  try {
    execSync(command, { stdio: 'pipe' });
    console.log(`✅ ${name} is available`);
    return true;
  } catch (error) {
    console.log(`❌ ${name} is not available or not working`);
    return false;
  }
}

function checkAWSCredentials() {
  try {
    const result = execSync('aws sts get-caller-identity', { encoding: 'utf8' });
    const identity = JSON.parse(result);
    console.log(`✅ AWS credentials are valid`);
    console.log(`   Account: ${identity.Account}`);
    console.log(`   User/Role: ${identity.Arn}`);
    return true;
  } catch (error) {
    console.log(`❌ AWS credentials are not configured or invalid`);
    console.log('   Please configure AWS credentials using one of:');
    console.log('   - aws configure');
    console.log('   - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
    console.log('   - IAM role (if running on EC2)');
    return false;
  }
}

function checkAWSPermissions() {
  const permissions = [
    { service: 's3', action: 'list-buckets', description: 'S3 bucket management' },
    { service: 'lambda', action: 'list-functions', description: 'Lambda function management' },
    { service: 'apigateway', action: 'get-rest-apis', description: 'API Gateway management' },
    { service: 'iam', action: 'list-roles', description: 'IAM role management' },
    { service: 'cloudfront', action: 'list-distributions', description: 'CloudFront management' },
    { service: 'dynamodb', action: 'list-tables', description: 'DynamoDB table management' }
  ];

  let allGood = true;
  console.log('\nChecking AWS permissions...');

  permissions.forEach(({ service, action, description }) => {
    try {
      execSync(`aws ${service} ${action}`, { stdio: 'pipe' });
      console.log(`✅ ${description}`);
    } catch (error) {
      console.log(`❌ ${description} - Missing permissions`);
      allGood = false;
    }
  });

  return allGood;
}

function checkFiles() {
  const requiredFiles = [
    { path: 'dist/apps/backend', description: 'Backend build output', required: false },
    { path: 'dist/apps/frontend', description: 'Frontend build output', required: false },
    { path: 'libs/shared/src/api/endpoints.ts', description: 'API endpoints definition', required: true },
    { path: 'apps/backend/src/db/scripts/table-definitions.ts', description: 'DynamoDB table definitions', required: true }
  ];

  let allGood = true;
  console.log('\nChecking required files...');

  requiredFiles.forEach(({ path, description, required }) => {
    if (fs.existsSync(path)) {
      console.log(`✅ ${description}: ${path}`);
    } else {
      const status = required ? '❌' : '⚠️ ';
      console.log(`${status} ${description}: ${path} ${required ? '(REQUIRED)' : '(will be created if needed)'}`);
      if (required) allGood = false;
    }
  });

  return allGood;
}

function checkEnvironmentVariables() {
  console.log('\nEnvironment Variables:');
  console.log(`  STAGE: ${STAGE}`);
  console.log(`  AWS_REGION: ${AWS_REGION}`);
  
  const optionalVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY', 
    'AWS_PROFILE',
    'CLOUDFRONT_PRICE_CLASS',
    'LAMBDA_TIMEOUT',
    'LAMBDA_MEMORY_SIZE',
    'SKIP_CLOUDFRONT'
  ];

  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      // Mask sensitive values
      const displayValue = varName.includes('SECRET') || varName.includes('KEY') 
        ? '*'.repeat(Math.min(value.length, 8))
        : value;
      console.log(`  ${varName}: ${displayValue}`);
    }
  });
}

function validateEnvironment() {
  console.log('🔍 Validating deployment environment...\n');
  console.log(`Stage: ${STAGE}`);
  console.log(`Region: ${AWS_REGION}\n`);

  let overallStatus = true;

  // Check required tools
  console.log('Checking required tools...');
  overallStatus &= checkCommand('aws --version', 'AWS CLI');
  overallStatus &= checkCommand('node --version', 'Node.js');
  overallStatus &= checkCommand('npm --version', 'npm');

  // Check AWS setup
  console.log('\nChecking AWS configuration...');
  overallStatus &= checkAWSCredentials();
  overallStatus &= checkAWSPermissions();

  // Check files
  overallStatus &= checkFiles();

  // Show environment variables
  checkEnvironmentVariables();

  console.log('\n' + '='.repeat(50));
  if (overallStatus) {
    console.log('🎉 Environment validation passed!');
    console.log('You can proceed with deployment.');
    
    console.log('\nRecommended deployment order:');
    console.log('1. npm run build (if not already built)');
    console.log('2. node scripts/prepare-deployment.js');
    console.log('3. node scripts/create-lambda-packages.js'); 
    console.log('4. node scripts/deploy-lambdas.js');
    console.log('5. node scripts/deploy-api-gateway.js');
    console.log('6. node scripts/deploy-frontend.js');
    console.log('7. node scripts/setup-cloudfront.js');
  } else {
    console.log('❌ Environment validation failed!');
    console.log('Please fix the issues above before deploying.');
    process.exit(1);
  }
}

if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment }; 