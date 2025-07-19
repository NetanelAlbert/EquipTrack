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
    
    // Create and attach least-privilege DynamoDB policy
    const policyName = `equip-track-dynamodb-policy-${STAGE}`;
    const dynamodbPolicy = {
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
        }
      ]
    };
    
    // Create the policy
    fs.writeFileSync('dynamodb-policy.json', JSON.stringify(dynamodbPolicy));
    try {
      execSync(`aws iam create-policy --policy-name ${policyName} --policy-document file://dynamodb-policy.json`, { stdio: 'pipe' });
    } catch (error) {
      // Policy might already exist
      console.log(`Policy ${policyName} might already exist`);
    }
    fs.unlinkSync('dynamodb-policy.json');
    
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

function deployLambdaFunction(handlerName, roleArn) {
  const functionName = `equip-track-${handlerName}-${STAGE}`;
  const zipPath = path.join(PACKAGES_DIR, `${handlerName}.zip`);
  
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Package not found: ${zipPath}`);
  }
  
  try {
    // Try to update existing function
    console.log(`Updating Lambda function: ${functionName}`);
    execSync(
      `aws lambda update-function-code --function-name ${functionName} --zip-file fileb://${zipPath}`,
      { stdio: 'inherit' }
    );
    
    // Update function configuration
    execSync(
      `aws lambda update-function-configuration --function-name ${functionName} ` +
      `--timeout ${LAMBDA_CONFIG.timeout} --memory-size ${LAMBDA_CONFIG.memorySize} ` +
      `--environment "Variables={STAGE=${STAGE}}"`,
      { stdio: 'inherit' }
    );
    
  } catch (error) {
    // Function doesn't exist, create it
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