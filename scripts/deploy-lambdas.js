#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getHandlerNames } = require('./create-lambda-packages');

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const PACKAGES_DIR = 'lambda-packages';

// Lambda configuration
const LAMBDA_CONFIG = {
  runtime: 'nodejs20.x',
  timeout: 30,
  memorySize: 256,
};

function getLambdaPolicyDocument() {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:BatchGetItem',
          'dynamodb:BatchWriteItem'
        ],
        Resource: [
          `arn:aws:dynamodb:${AWS_REGION}:*:table/UsersAndOrganizations*`,
          `arn:aws:dynamodb:${AWS_REGION}:*:table/Inventory*`,
          `arn:aws:dynamodb:${AWS_REGION}:*:table/Forms*`,
          `arn:aws:dynamodb:${AWS_REGION}:*:table/EquipTrackReport*`,
          `arn:aws:dynamodb:${AWS_REGION}:*:table/*/index/*`
        ]
      },
      {
        Effect: 'Allow',
        Action: [
          'secretsmanager:GetSecretValue'
        ],
        Resource: [
          `arn:aws:secretsmanager:${AWS_REGION}:*:secret:equip-track/jwt-private-key*`,
          `arn:aws:secretsmanager:${AWS_REGION}:*:secret:equip-track/jwt-public-key*`
        ]
      },
      {
        Effect: 'Allow',
        Action: [
          's3:PutObject',
          's3:GetObject',
          's3:DeleteObject'
        ],
        Resource: [
          `arn:aws:s3:::equip-track-forms/*`,
          `arn:aws:s3:::equip-track-forms-${STAGE}/*`
        ]
      }
    ]
  };
}

function updateRolePolicy(roleName) {
  const policyName = `equip-track-lambda-policy-${STAGE}`;
  const lambdaPolicy = getLambdaPolicyDocument();
  
  console.log(`Updating policy for existing role: ${roleName}`);
  
  // Create temporary policy file
  fs.writeFileSync('lambda-policy-update.json', JSON.stringify(lambdaPolicy));
  
  try {
    // Try to update existing policy
    const accountId = JSON.parse(execSync('aws sts get-caller-identity', { encoding: 'utf8' })).Account;
    const policyArn = `arn:aws:iam::${accountId}:policy/${policyName}`;
    
    // Get current policy version
    const policyVersions = JSON.parse(execSync(
      `aws iam list-policy-versions --policy-arn ${policyArn}`,
      { encoding: 'utf8' }
    ));
    
    // Create new policy version
    execSync(
      `aws iam create-policy-version --policy-arn ${policyArn} --policy-document file://lambda-policy-update.json --set-as-default`,
      { stdio: 'pipe' }
    );
    
    console.log(`✅ Updated policy: ${policyName}`);
    
    // Clean up old versions (keep only the latest and one previous)
    const versionsToDelete = policyVersions.Versions
      .filter(v => !v.IsDefaultVersion)
      .sort((a, b) => new Date(b.CreateDate) - new Date(a.CreateDate))
      .slice(1); // Keep the most recent non-default version
    
    for (const version of versionsToDelete) {
      try {
        execSync(
          `aws iam delete-policy-version --policy-arn ${policyArn} --version-id ${version.VersionId}`,
          { stdio: 'pipe' }
        );
      } catch (error) {
        // Ignore errors when deleting old versions
      }
    }
    
  } catch (error) {
    console.log(`Policy ${policyName} might not exist yet, will be created with role`);
  } finally {
    // Clean up temporary file
    if (fs.existsSync('lambda-policy-update.json')) {
      fs.unlinkSync('lambda-policy-update.json');
    }
  }
}

function ensureRole() {
  const roleName = `equip-track-lambda-role-${STAGE}`;
  const policyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'lambda.amazonaws.com'
        },
        Action: 'sts:AssumeRole'
      }
    ]
  };

  try {
    // Try to get existing role
    const result = execSync(`aws iam get-role --role-name ${roleName}`, { encoding: 'utf8' });
    const roleArn = JSON.parse(result).Role.Arn;
    console.log(`Using existing role: ${roleArn}`);
    
    // Update policy for existing role to ensure it has latest permissions
    updateRolePolicy(roleName);
    
    return roleArn;
  } catch (error) {
    console.log(`Creating new role: ${roleName}`);
    
    // Create the role
    const createResult = execSync(
      `aws iam create-role --role-name ${roleName} --assume-role-policy-document '${JSON.stringify(policyDocument)}'`,
      { encoding: 'utf8' }
    );
    const roleArn = JSON.parse(createResult).Role.Arn;
    
    // Attach basic execution policy
    execSync(
      `aws iam attach-role-policy --role-name ${roleName} --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`
    );
    
    // Create and attach least-privilege DynamoDB, Secrets Manager, and S3 policy
    const policyName = `equip-track-lambda-policy-${STAGE}`;
    const lambdaPolicy = getLambdaPolicyDocument();
    
    // Create the policy
    fs.writeFileSync('lambda-policy.json', JSON.stringify(lambdaPolicy));
    try {
      execSync(`aws iam create-policy --policy-name ${policyName} --policy-document file://lambda-policy.json`, { stdio: 'pipe' });
    } catch (error) {
      // Policy might already exist
      console.log(`Policy ${policyName} might already exist`);
    }
    fs.unlinkSync('lambda-policy.json');
    
    // Attach the custom policy
    try {
      const accountId = JSON.parse(execSync('aws sts get-caller-identity', { encoding: 'utf8' })).Account;
      execSync(
        `aws iam attach-role-policy --role-name ${roleName} --policy-arn arn:aws:iam::${accountId}:policy/${policyName}`
      );
    } catch (error) {
      console.log('Note: Policy attachment may have failed, but continuing...');
    }
    
    console.log(`✅ Created role: ${roleArn}`);
    
    // Wait for role to propagate with proper checking
    console.log('Waiting for role to propagate...');
    let attempts = 0;
    const maxAttempts = 12; // 2 minutes max
    while (attempts < maxAttempts) {
      try {
        // Try to assume the role to verify it's ready
        execSync(`aws sts assume-role --role-arn ${roleArn} --role-session-name test-session`, { stdio: 'pipe' });
        console.log('✅ Role is ready');
        break;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.log('⚠️ Role may not be fully propagated, but continuing...');
          break;
        }
        console.log(`Role not ready yet, waiting... (${attempts}/${maxAttempts})`);
        execSync('sleep 10');
      }
    }
    
    return roleArn;
  }
}

function waitForLambdaUpdate(functionName, maxAttempts = 12) {
  console.log(`Waiting for ${functionName} to be ready for configuration update...`);
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const result = execSync(
        `aws lambda get-function --function-name ${functionName}`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      const functionInfo = JSON.parse(result);
      
      if (functionInfo.Configuration.LastUpdateStatus === 'Successful') {
        console.log(`✅ ${functionName} is ready for configuration update`);
        return true;
      } else if (functionInfo.Configuration.LastUpdateStatus === 'Failed') {
        console.log(`❌ ${functionName} update failed: ${functionInfo.Configuration.LastUpdateStatusReason}`);
        return false;
      }
      
      attempts++;
      console.log(`${functionName} status: ${functionInfo.Configuration.LastUpdateStatus}, waiting... (${attempts}/${maxAttempts})`);
      execSync('sleep 5');
      
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        console.log(`⚠️ Could not verify ${functionName} status, but continuing...`);
        return true;
      }
      console.log(`Error checking status, retrying... (${attempts}/${maxAttempts})`);
      execSync('sleep 5');
    }
  }
  
  console.log(`⚠️ Timeout waiting for ${functionName} to be ready, but continuing...`);
  return true;
}

function deployLambdaFunction(handlerName, roleArn) {
  const functionName = `equip-track-${handlerName}-${STAGE}`;
  const zipPath = path.join(PACKAGES_DIR, `${handlerName}.zip`);
  
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Package not found: ${zipPath}`);
  }
  
  let functionExists = false;
  
  // Check if function exists
  try {
    execSync(`aws lambda get-function --function-name ${functionName}`, { stdio: 'pipe' });
    functionExists = true;
  } catch (error) {
    functionExists = false;
  }
  
  if (functionExists) {
    // Update existing function
    console.log(`Updating Lambda function: ${functionName}`);
    try {
      execSync(
        `aws lambda update-function-code --function-name ${functionName} --zip-file fileb://${zipPath}`,
        { stdio: 'inherit' }
      );
      
      // Wait for code update to complete before updating configuration
      if (waitForLambdaUpdate(functionName)) {
        try {
          execSync(
            `aws lambda update-function-configuration --function-name ${functionName} ` +
            `--timeout ${LAMBDA_CONFIG.timeout} --memory-size ${LAMBDA_CONFIG.memorySize} ` +
            `--environment "Variables={STAGE=${STAGE}}"`,
            { stdio: 'inherit' }
          );
        } catch (configError) {
          if (configError.message.includes('ResourceConflictException')) {
            console.log(`⚠️ Configuration update skipped for ${functionName} - update still in progress`);
          } else {
            throw configError;
          }
        }
      }
    } catch (codeError) {
      if (codeError.message.includes('ResourceConflictException')) {
        console.log(`⚠️ Code update skipped for ${functionName} - update already in progress`);
      } else {
        throw codeError;
      }
    }
  } else {
    // Create new function
    console.log(`Creating Lambda function: ${functionName}`);
    execSync(
      `aws lambda create-function --function-name ${functionName} ` +
      `--runtime ${LAMBDA_CONFIG.runtime} ` +
      `--role ${roleArn} ` +
      `--handler index.handler ` +
      `--zip-file fileb://${zipPath} ` +
      `--timeout ${LAMBDA_CONFIG.timeout} ` +
      `--memory-size ${LAMBDA_CONFIG.memorySize} ` +
      `--environment "Variables={STAGE=${STAGE}}"`,
      { stdio: 'inherit' }
    );
  }
  
  console.log(`✅ Deployed ${functionName}`);
  return functionName;
}

function deployAllLambdas() {
  console.log('Deploying Lambda functions...');
  
  if (!fs.existsSync(PACKAGES_DIR)) {
    throw new Error(`Packages directory not found: ${PACKAGES_DIR}`);
  }
  
  const roleArn = ensureRole();
  const handlerNames = getHandlerNames();
  const deployedFunctions = [];
  
  handlerNames.forEach(handlerName => {
    const functionName = deployLambdaFunction(handlerName, roleArn);
    deployedFunctions.push({ handlerName, functionName });
  });
  
  console.log('\n🎉 All Lambda functions deployed successfully!');
  console.log('\nDeployed functions:');
  deployedFunctions.forEach(({ handlerName, functionName }) => {
    console.log(`  - ${handlerName} -> ${functionName}`);
  });
  
  // Update deployment info with Lambda functions
  let deploymentInfo = {};
  if (fs.existsSync('deployment-info.json')) {
    deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  } else {
    // Fallback if prepare script wasn't run
    deploymentInfo = {
      stage: STAGE,
      region: AWS_REGION
    };
  }
  
  deploymentInfo.backend = deploymentInfo.backend || {};
  deploymentInfo.backend.lambdas = {
    functions: deployedFunctions,
    role: roleArn,
    status: 'deployed'
  };
  
  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
  
  return deployedFunctions;
}

if (require.main === module) {
  deployAllLambdas();
}

module.exports = { deployAllLambdas }; 