#!/usr/bin/env node
/**
 * Restore API Gateway identifiers into deployment-info.json when CI recreates the file.
 * Used for frontend-only deploys or when skipping a full API Gateway sync (Lambda-only updates).
 */
const { execSync } = require('child_process');
const fs = require('fs');

process.env.AWS_PAGER = '';

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';

function setGithubOutput(name, value) {
  const outFile = process.env.GITHUB_OUTPUT;
  if (outFile) {
    fs.appendFileSync(outFile, `${name}=${value}\n`);
  }
}

function findPrimaryRestApi() {
  const baseApiName = `equip-track-api-${STAGE}`;
  const result = execSync('aws apigateway get-rest-apis', { encoding: 'utf8' });
  const apis = JSON.parse(result).items || [];
  const primary = apis.find((api) => api.name === baseApiName);
  return primary || null;
}

function hydrateBackendInfraFromAws() {
  if (!fs.existsSync('deployment-info.json')) {
    console.log('⚠️ deployment-info.json missing — run prepare-deployment first');
    setGithubOutput('api_exists', 'false');
    process.exit(0);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  const existing = findPrimaryRestApi();

  if (!existing) {
    console.log(`ℹ️ No REST API named equip-track-api-${STAGE} found in ${AWS_REGION}`);
    setGithubOutput('api_exists', 'false');
    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    return;
  }

  const apiId = existing.id;
  const apiUrl = `https://${apiId}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE}`;

  deploymentInfo.backend = deploymentInfo.backend || {};
  deploymentInfo.backend.apiGateway = {
    ...(deploymentInfo.backend.apiGateway || {}),
    apiId,
    apiUrl,
    status: 'hydrated'
  };

  deploymentInfo.api = {
    apiId,
    apiUrl,
    deploymentId: deploymentInfo.api?.deploymentId ?? null
  };

  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Hydrated backend API from AWS: ${apiId}`);
  setGithubOutput('api_exists', 'true');
}

if (require.main === module) {
  try {
    hydrateBackendInfraFromAws();
  } catch (error) {
    console.error(`⚠️ Backend infra hydration failed: ${error.message}`);
    setGithubOutput('api_exists', 'false');
    process.exit(0);
  }
}

module.exports = { hydrateBackendInfraFromAws, findPrimaryRestApi };
