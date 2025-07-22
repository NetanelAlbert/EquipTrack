#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Load endpoint definitions from config file
function loadEndpoints() {
  console.log('📖 Loading endpoints from config...');
  
  // Read from endpoints-config.json created by prepare script
  if (!fs.existsSync('endpoints-config.json')) {
    throw new Error('❌ endpoints-config.json not found. Run "node scripts/prepare-deployment.js" first.');
  }
  
  try {
    const config = JSON.parse(fs.readFileSync('endpoints-config.json', 'utf8'));
    console.log(`✅ Loaded ${Object.keys(config.endpoints).length} endpoints from config`);
    return config.endpoints;
  } catch (error) {
    throw new Error(`❌ Failed to read endpoints-config.json: ${error.message}`);
  }
}

function createOrUpdateAPI() {
  const apiName = `equip-track-api-${STAGE}`;
  
  try {
    // Try to find existing API
    const result = execSync(`aws apigateway get-rest-apis`, { encoding: 'utf8' });
    const apis = JSON.parse(result).items;
    const existingAPI = apis.find(api => api.name === apiName);
    
    if (existingAPI) {
      console.log(`Using existing API: ${existingAPI.id}`);
      return existingAPI.id;
    }
  } catch (error) {
    console.log('Error checking for existing APIs, will create new one');
  }
  
  // Create new API
  console.log(`Creating new API: ${apiName}`);
  const createResult = execSync(
    `aws apigateway create-rest-api --name ${apiName} --description "EquipTrack API - ${STAGE}"`,
    { encoding: 'utf8' }
  );
  const apiId = JSON.parse(createResult).id;
  console.log(`✅ Created API: ${apiId}`);
  return apiId;
}

function getAccountId() {
  const result = execSync('aws sts get-caller-identity', { encoding: 'utf8' });
  return JSON.parse(result).Account;
}

function getResources(apiId) {
  const result = execSync(`aws apigateway get-resources --rest-api-id ${apiId}`, { encoding: 'utf8' });
  return JSON.parse(result).items;
}

function createResourcePath(apiId, path, existingResources) {
  const pathParts = path.split('/').filter(part => part);
  let currentPath = '';
  let parentId = existingResources.find(r => r.path === '/')?.id;
  
  for (const part of pathParts) {
    currentPath += `/${part}`;
    let resource = existingResources.find(r => r.path === currentPath);
    
    if (!resource) {
      console.log(`Creating resource: ${currentPath}`);
      const result = execSync(
        `aws apigateway create-resource --rest-api-id ${apiId} --parent-id ${parentId} --path-part "${part}"`,
        { encoding: 'utf8' }
      );
      resource = JSON.parse(result);
      existingResources.push(resource);
    }
    
    parentId = resource.id;
  }
  
  return parentId;
}

function createMethod(apiId, resourceId, method, functionName) {
  const accountId = getAccountId();
  const lambdaUri = `arn:aws:apigateway:${AWS_REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${AWS_REGION}:${accountId}:function:${functionName}/invocations`;
  
  try {
    // Create method
    execSync(
      `aws apigateway put-method --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${method} --authorization-type NONE`,
      { stdio: 'inherit' }
    );
    
    // Create integration
    execSync(
      `aws apigateway put-integration --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${method} --type AWS_PROXY --integration-http-method POST --uri "${lambdaUri}"`,
      { stdio: 'inherit' }
    );
    
    // Add method response with CORS headers (200)
    execSync(
      `aws apigateway put-method-response --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${method} --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Credentials=false"`,
      { stdio: 'inherit' }
    );
    
    // Add method response with CORS headers (4xx errors)
    execSync(
      `aws apigateway put-method-response --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${method} --status-code 400 --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Credentials=false"`,
      { stdio: 'pipe' }
    );
    
    // Add method response with CORS headers (5xx errors)
    execSync(
      `aws apigateway put-method-response --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${method} --status-code 500 --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Credentials=false"`,
      { stdio: 'pipe' }
    );
    
    // Add integration response with CORS headers (200)
    execSync(
      `aws apigateway put-integration-response --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${method} --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Origin='*',method.response.header.Access-Control-Allow-Headers='Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With',method.response.header.Access-Control-Allow-Methods='GET,POST,PUT,DELETE,OPTIONS',method.response.header.Access-Control-Allow-Credentials='false'"`,
      { stdio: 'inherit' }
    );
    
    // Add integration response with CORS headers (4xx errors)
    execSync(
      `aws apigateway put-integration-response --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${method} --status-code 400 --selection-pattern "4\\\\d{2}" --response-parameters "method.response.header.Access-Control-Allow-Origin='*',method.response.header.Access-Control-Allow-Headers='Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With',method.response.header.Access-Control-Allow-Methods='GET,POST,PUT,DELETE,OPTIONS',method.response.header.Access-Control-Allow-Credentials='false'"`,
      { stdio: 'pipe' }
    );
    
    // Add integration response with CORS headers (5xx errors)
    execSync(
      `aws apigateway put-integration-response --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${method} --status-code 500 --selection-pattern "5\\\\d{2}" --response-parameters "method.response.header.Access-Control-Allow-Origin='*',method.response.header.Access-Control-Allow-Headers='Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With',method.response.header.Access-Control-Allow-Methods='GET,POST,PUT,DELETE,OPTIONS',method.response.header.Access-Control-Allow-Credentials='false'"`,
      { stdio: 'pipe' }
    );
    
    // Add Lambda permission
    const statementId = `${functionName}-${method}-${resourceId}`.replace(/[^a-zA-Z0-9-]/g, '-');
    try {
      execSync(
        `aws lambda add-permission --function-name ${functionName} --statement-id "${statementId}" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${AWS_REGION}:${accountId}:${apiId}/*/*"`,
        { stdio: 'inherit' }
      );
    } catch (error) {
      // Permission might already exist
      console.log(`Permission for ${functionName} might already exist`);
    }
    
  } catch (error) {
    console.log(`Error creating method ${method} for resource ${resourceId}:`, error.message);
  }
}

function createOptionsMethod(apiId, resourceId) {
  try {
    // Create OPTIONS method for CORS preflight
    execSync(
      `aws apigateway put-method --rest-api-id ${apiId} --resource-id ${resourceId} --http-method OPTIONS --authorization-type NONE --api-key-required false`,
      { stdio: 'inherit' }
    );
    
    // Create mock integration for OPTIONS with proper request template
    execSync(
      `aws apigateway put-integration --rest-api-id ${apiId} --resource-id ${resourceId} --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\\"statusCode\\": 200}"}' --passthrough-behavior WHEN_NO_MATCH`,
      { stdio: 'inherit' }
    );
    
    // Add method response for OPTIONS with CORS headers
    execSync(
      `aws apigateway put-method-response --rest-api-id ${apiId} --resource-id ${resourceId} --http-method OPTIONS --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Credentials=false,method.response.header.Access-Control-Max-Age=false"`,
      { stdio: 'inherit' }
    );
    
    // Add integration response for OPTIONS with CORS headers and proper response template
    execSync(
      `aws apigateway put-integration-response --rest-api-id ${apiId} --resource-id ${resourceId} --http-method OPTIONS --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Origin='*',method.response.header.Access-Control-Allow-Headers='Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With,Access-Control-Request-Method,Access-Control-Request-Headers',method.response.header.Access-Control-Allow-Methods='GET,POST,PUT,DELETE,OPTIONS',method.response.header.Access-Control-Allow-Credentials='false',method.response.header.Access-Control-Max-Age='86400'" --response-templates '{"application/json":""}'`,
      { stdio: 'inherit' }
    );
    
  } catch (error) {
    console.log(`Error creating OPTIONS method for resource ${resourceId}:`, error.message);
  }
}

function deployAPI(apiId) {
  console.log(`Deploying API to stage: ${STAGE}`);
  
  // Create deployment
  const result = execSync(
    `aws apigateway create-deployment --rest-api-id ${apiId} --stage-name ${STAGE} --stage-description "Deployment for ${STAGE}"`,
    { encoding: 'utf8' }
  );
  
  const deploymentId = JSON.parse(result).id;
  console.log(`✅ Deployed API with deployment ID: ${deploymentId}`);
  
  const apiUrl = `https://${apiId}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE}`;
  console.log(`🌐 API URL: ${apiUrl}`);
  
  return { apiId, deploymentId, apiUrl };
}

function deployAPIGateway() {
  console.log('Deploying API Gateway...');
  
  // Load deployment info
  if (!fs.existsSync('deployment-info.json')) {
    throw new Error('deployment-info.json not found. Run deploy-lambdas.js first.');
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  const endpoints = loadEndpoints();
  
  const apiId = createOrUpdateAPI();
  const existingResources = getResources(apiId);
  
  // Create resources and methods for each endpoint
  const resourcesWithOptions = new Set();
  
  Object.keys(endpoints).forEach(handlerName => {
    const endpoint = endpoints[handlerName];
    const functionName = `equip-track-${handlerName}-${STAGE}`;
    
    console.log(`Setting up ${endpoint.method} ${endpoint.path} -> ${functionName}`);
    
    const resourceId = createResourcePath(apiId, endpoint.path, existingResources);
    createMethod(apiId, resourceId, endpoint.method, functionName);
    
    // Create OPTIONS method for CORS preflight (only once per resource)
    if (!resourcesWithOptions.has(resourceId)) {
      console.log(`Adding CORS OPTIONS method for ${endpoint.path}`);
      createOptionsMethod(apiId, resourceId);
      resourcesWithOptions.add(resourceId);
    }
  });
  
  // Deploy the API
  const deployment = deployAPI(apiId);
  
  // Update deployment info with API Gateway details
  deploymentInfo.backend = deploymentInfo.backend || {};
  deploymentInfo.backend.apiGateway = {
    apiId: deployment.apiId,
    apiUrl: deployment.apiUrl,
    deploymentId: deployment.deploymentId,
    status: 'deployed'
  };
  
  // Keep legacy api property for backward compatibility
  deploymentInfo.api = deployment;
  
  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
  
  console.log('\n🎉 API Gateway deployment completed!');
  console.log(`API URL: ${deployment.apiUrl}`);
  
  return deployment;
}

if (require.main === module) {
  deployAPIGateway();
}

module.exports = { deployAPIGateway }; 