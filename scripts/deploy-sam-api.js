#!/usr/bin/env node
/**
 * Deploy EquipTrack REST API + Lambdas + optional custom domain via AWS SAM.
 * Lambda functions use one shared zip on S3 (see create-lambda-packages.js); template references it via parameters.
 *
 * Env:
 *   STAGE, AWS_REGION, BASE_DOMAIN (default equip-track.com)
 *   API_HOSTNAME — optional override; default dev-api.<base> / api.<base>
 *   API_GATEWAY_REGIONAL_CERTIFICATE_ARN — optional; if set with ApiHostname, SAM creates custom domain + base path mapping
 *   After deploy, setup-api-custom-domain.js always runs (mapping + Route53 UPSERT)
 *   E2E_AUTH_ENABLED, E2E_AUTH_SECRET — forwarded to SAM (E2eAuthEnabled / E2eAuthSecret parameters)
 *   LAMBDA_CODE_BUCKET — override S3 bucket for shared Lambda zip (default equip-track-lambda-code-<STAGE>)
 *   PRUNE_LEGACY_API_GATEWAY — must be 'true' to opt in: before first stack create, remove REST APIs
 *     named equip-track-api-<STAGE> and domain mappings pointing at them (destructive; confirm account/stage)
 */
const { execFileSync, execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  ensureLambdaCodeBucket,
  uploadSharedLambdaBundle,
  getLambdaCodeBucketName,
} = require('./deploy-lambdas');
const { getHandlerNames, SHARED_BUNDLE_ZIP } = require('./create-lambda-packages');

process.env.AWS_PAGER = '';

const ROOT = path.join(__dirname, '..');
const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'equip-track.com';
const STACK_NAME = `equip-track-api-stack-${STAGE}`;
const TEMPLATE_SRC = path.join(ROOT, 'infra', 'sam', 'template.yaml');
const TEMPLATE_BUILD = path.join(ROOT, '.aws-sam', 'build', 'template.yaml');
const PACKAGES_DIR = path.join(ROOT, 'lambda-packages');
const GENERATE_SAM = path.join(ROOT, 'scripts', 'generate-sam-template.js');

function computeSharedZipS3Key() {
  const zipPath = path.join(PACKAGES_DIR, SHARED_BUNDLE_ZIP);
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Missing ${zipPath} — run node scripts/create-lambda-packages.js first`);
  }
  const buf = fs.readFileSync(zipPath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  return `lambda-code/${hash}/${SHARED_BUNDLE_ZIP}`;
}

function generateSamTemplateFromEndpoints() {
  console.log('📝 Regenerating infra/sam/template.yaml from endpoint definitions...');
  execFileSync(process.execPath, [GENERATE_SAM], { stdio: 'inherit', cwd: ROOT, env: process.env });
}

function uploadLambdaBundleForSam() {
  const bucket = getLambdaCodeBucketName();
  ensureLambdaCodeBucket(bucket);
  const s3Key = computeSharedZipS3Key();
  const zipPath = path.join(PACKAGES_DIR, SHARED_BUNDLE_ZIP);
  uploadSharedLambdaBundle(bucket, s3Key, zipPath);
  return { bucket, s3Key };
}

function defaultApiHostname() {
  if (process.env.API_HOSTNAME && process.env.API_HOSTNAME.trim()) {
    return process.env.API_HOSTNAME.trim();
  }
  return STAGE === 'production'
    ? `api.${BASE_DOMAIN}`
    : `${STAGE}-api.${BASE_DOMAIN}`;
}

function assertSafeHostname(h) {
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(h) && !/^[a-z0-9]+$/i.test(h)) {
    throw new Error(`Refusing unsafe API_HOSTNAME: ${h}`);
  }
}

function describeStack(name) {
  try {
    const out = execFileSync(
      'aws',
      ['cloudformation', 'describe-stacks', '--stack-name', name, '--output', 'json'],
      { encoding: 'utf8', cwd: ROOT }
    );
    return JSON.parse(out).Stacks[0];
  } catch (e) {
    const msg = `${e.stderr || ''}${e.message || ''}`;
    if (msg.includes('does not exist') || msg.includes('ValidationError')) {
      return null;
    }
    throw e;
  }
}

function stackExistsAndRetained(stack) {
  if (!stack) return false;
  const s = stack.StackStatus;
  if (s === 'DELETE_COMPLETE') return false;
  return true;
}

function listRestApis() {
  const out = execFileSync(
    'aws',
    ['apigateway', 'get-rest-apis', '--output', 'json'],
    { encoding: 'utf8', cwd: ROOT }
  );
  return JSON.parse(out).items || [];
}

function getBasePathMappings(domainName) {
  try {
    const out = execFileSync(
      'aws',
      ['apigateway', 'get-base-path-mappings', '--domain-name', domainName, '--output', 'json'],
      { encoding: 'utf8', cwd: ROOT }
    );
    return JSON.parse(out).items || [];
  } catch (e) {
    const msg = `${e.stderr || ''}${e.message || ''}`;
    if (msg.includes('NotFoundException')) return [];
    throw e;
  }
}

function deleteBasePathMapping(domainName, basePath) {
  const args = ['apigateway', 'delete-base-path-mapping', '--domain-name', domainName];
  if (basePath && String(basePath).trim()) {
    args.push('--base-path', basePath);
  }
  execFileSync('aws', args, { stdio: 'inherit', cwd: ROOT });
}

function removeDomainMappingsToApis(domainName, apiIds) {
  const set = new Set(apiIds);
  const items = getBasePathMappings(domainName);
  for (const m of items) {
    if (set.has(m.restApiId)) {
      console.log(
        `🧹 Removing base path mapping on ${domainName} -> API ${m.restApiId} (basePath="${m.basePath || '(none)'}")`
      );
      deleteBasePathMapping(domainName, m.basePath || '');
    }
  }
}

function deleteRestApi(apiId) {
  console.log(`🗑️ Deleting REST API ${apiId}`);
  execFileSync('aws', ['apigateway', 'delete-rest-api', '--rest-api-id', apiId], {
    stdio: 'inherit',
    cwd: ROOT,
  });
}

function pruneLegacyApisIfNeeded(apiHostname) {
  const enabled = (process.env.PRUNE_LEGACY_API_GATEWAY || '').toLowerCase() === 'true';
  if (!enabled) {
    console.log(
      'ℹ️ Legacy API prune is off (set PRUNE_LEGACY_API_GATEWAY=true only after confirming account, STAGE, and API names to remove)'
    );
    return;
  }

  const stack = describeStack(STACK_NAME);
  if (stackExistsAndRetained(stack)) {
    console.log(`ℹ️ CloudFormation stack ${STACK_NAME} exists — skipping legacy API prune`);
    return;
  }

  const targetName = `equip-track-api-${STAGE}`;
  const apis = listRestApis().filter((a) => a.name === targetName);
  if (apis.length === 0) {
    console.log(`ℹ️ No REST APIs named ${targetName} to prune`);
    return;
  }

  let accountId = 'unknown';
  try {
    const idOut = execFileSync(
      'aws',
      ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'],
      { encoding: 'utf8', cwd: ROOT }
    );
    accountId = idOut.trim() || accountId;
  } catch {
    // continue with unknown account in banner only
  }

  console.log('\n⚠️  PRUNE_LEGACY_API_GATEWAY=true — irreversible delete of the following:');
  console.log(`   AWS account: ${accountId}`);
  console.log(`   Region:      ${AWS_REGION}`);
  console.log(`   STAGE:       ${STAGE}`);
  console.log(`   API name:    ${targetName}`);
  apis.forEach((a) => console.log(`   - REST API id ${a.id} (${a.name})`));
  console.log(`   Custom host: ${apiHostname} (base path mappings to those APIs will be removed)\n`);

  const ids = apis.map((a) => a.id);
  assertSafeHostname(apiHostname);
  removeDomainMappingsToApis(apiHostname, ids);

  for (const a of apis) {
    deleteRestApi(a.id);
  }
  console.log(`✅ Pruned ${apis.length} REST API(s) named ${targetName}`);
  console.log('⏳ Waiting for API Gateway deletes to propagate...');
  execSync('sleep 8', { stdio: 'inherit', cwd: ROOT });
}

function samBuild() {
  console.log('📦 sam build...');
  execFileSync('sam', ['build', '-t', TEMPLATE_SRC], { stdio: 'inherit', cwd: ROOT, env: process.env });
  if (!fs.existsSync(TEMPLATE_BUILD)) {
    throw new Error(`Expected built template at ${TEMPLATE_BUILD}`);
  }
}

function samDeploy(certArn, apiHostname, lambdaCode) {
  const e2eEnabled = (process.env.E2E_AUTH_ENABLED || '').toLowerCase() === 'true' ? 'true' : 'false';
  const e2eSecret = (process.env.E2E_AUTH_SECRET || '').trim();
  const overrides = [
    `Stage=${STAGE}`,
    `CertificateArn=${certArn}`,
    `ApiHostname=${apiHostname}`,
    `LambdaCodeBucketName=${lambdaCode.bucket}`,
    `LambdaCodeS3Key=${lambdaCode.s3Key}`,
    `E2eAuthEnabled=${e2eEnabled}`,
    `E2eAuthSecret=${e2eSecret}`,
  ];
  console.log('🚀 sam deploy...');
  execFileSync(
    'sam',
    [
      'deploy',
      '--template-file',
      TEMPLATE_BUILD,
      '--stack-name',
      STACK_NAME,
      '--no-confirm-changeset',
      '--capabilities',
      'CAPABILITY_IAM',
      '--resolve-s3',
      '--region',
      AWS_REGION,
      '--parameter-overrides',
      ...overrides,
    ],
    { stdio: 'inherit', cwd: ROOT, env: process.env }
  );
}

function readStackOutputs() {
  const stack = describeStack(STACK_NAME);
  if (!stack) throw new Error(`Stack ${STACK_NAME} not found after deploy`);
  const map = {};
  for (const o of stack.Outputs || []) {
    map[o.OutputKey] = o.OutputValue;
  }
  return map;
}

function mergeDeploymentInfo(outputs, apiHostname, usedSamDomain, lambdaCode) {
  const deploymentInfoPath = path.join(ROOT, 'deployment-info.json');
  if (!fs.existsSync(deploymentInfoPath)) {
    throw new Error('deployment-info.json missing — run prepare-deployment first');
  }
  const di = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf8'));
  const apiId = outputs.RestApiId;
  const apiUrl = outputs.ApiUrl;

  const handlerNames = getHandlerNames();
  const deployedFunctions = handlerNames.map((handlerName) => ({
    handlerName,
    functionName: `equip-track-${handlerName}-${STAGE}`,
  }));

  di.backend = di.backend || {};
  di.backend.lambdas = {
    functions: deployedFunctions,
    role: `sam:${STACK_NAME}/EquipTrackLambdaRole`,
    codePackage: {
      bucket: lambdaCode.bucket,
      key: lambdaCode.s3Key,
      artifact: SHARED_BUNDLE_ZIP,
      managedBy: 'sam',
    },
    status: 'deployed',
    samStackName: STACK_NAME,
  };

  di.backend.apiGateway = {
    ...(di.backend.apiGateway || {}),
    apiId,
    apiUrl,
    status: 'deployed',
    samStackName: STACK_NAME,
  };
  di.api = {
    apiId,
    apiUrl,
    deploymentId: di.api?.deploymentId ?? null,
  };

  if (usedSamDomain && outputs.CustomDomainUrl) {
    di.customDomains = di.customDomains || {};
    di.customDomains[apiHostname] = {
      ...(di.customDomains[apiHostname] || {}),
      domainName: apiHostname,
      status: 'active',
      apiId,
      stage: STAGE,
      samManaged: true,
      lastUpdated: new Date().toISOString(),
    };
    di.backend.apiGateway.customDomain = apiHostname;
    di.backend.apiGateway.customApiUrl = outputs.CustomDomainUrl;
  }

  fs.writeFileSync(deploymentInfoPath, JSON.stringify(di, null, 2));
  console.log(`✅ Updated ${deploymentInfoPath}`);
}

function runCustomDomainReconciliation() {
  console.log(
    '🌐 Running setup-api-custom-domain.js (base path mapping + Route53 UPSERT; safe if domain already exists)'
  );
  execFileSync('node', ['scripts/setup-api-custom-domain.js'], {
    stdio: 'inherit',
    cwd: ROOT,
    env: process.env,
  });
}

function main() {
  const apiHostname = defaultApiHostname();
  assertSafeHostname(apiHostname);

  const certArn = (process.env.API_GATEWAY_REGIONAL_CERTIFICATE_ARN || '').trim();
  const usedSamDomain = Boolean(certArn);

  pruneLegacyApisIfNeeded(apiHostname);

  const preStack = describeStack(STACK_NAME);
  if (preStack) {
    const st = preStack.StackStatus || '';
    if (
      st === 'ROLLBACK_COMPLETE' ||
      st === 'CREATE_FAILED' ||
      st === 'UPDATE_ROLLBACK_FAILED'
    ) {
      throw new Error(
        `CloudFormation stack ${STACK_NAME} is ${st}. Delete the stack in AWS (console or \`aws cloudformation delete-stack\`) and re-run this deploy.`
      );
    }
  }

  generateSamTemplateFromEndpoints();
  const lambdaCode = uploadLambdaBundleForSam();
  samBuild();
  samDeploy(certArn, apiHostname, lambdaCode);

  const outputs = readStackOutputs();
  mergeDeploymentInfo(outputs, apiHostname, usedSamDomain, lambdaCode);

  // Route53 alias + mapping reconciliation (UPSERT) — avoids CFN conflicts with existing A records
  runCustomDomainReconciliation();

  console.log('\n🎉 SAM API deploy complete');
  console.log(`   Execute-api: ${outputs.ApiUrl}`);
  if (outputs.CustomDomainUrl) {
    console.log(`   Custom URL:  ${outputs.CustomDomainUrl}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`\n💥 deploy-sam-api failed: ${e.message}`);
    process.exit(1);
  }
}

module.exports = { main, defaultApiHostname, STACK_NAME };
