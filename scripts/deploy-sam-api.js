#!/usr/bin/env node
/**
 * Deploy EquipTrack REST API + optional custom domain via AWS SAM.
 * Replaces scripts/deploy-api-gateway.js for CloudFormation-managed topology.
 *
 * Env:
 *   STAGE, AWS_REGION, BASE_DOMAIN (default equip-track.com)
 *   API_HOSTNAME — optional override; default dev-api.<base> / api.<base>
 *   API_GATEWAY_REGIONAL_CERTIFICATE_ARN — optional; if set with ApiHostname, SAM creates custom domain + base path mapping
 *   ROUTE53_HOSTED_ZONE_ID — optional; if set with cert, SAM creates Route53 alias
 *   PRUNE_LEGACY_API_GATEWAY — must be 'true' to opt in: before first stack create, remove REST APIs
 *     named equip-track-api-<STAGE> and domain mappings pointing at them (destructive; confirm account/stage)
 */
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

process.env.AWS_PAGER = '';

const ROOT = path.join(__dirname, '..');
const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'equip-track.com';
const STACK_NAME = `equip-track-api-stack-${STAGE}`;
const TEMPLATE_SRC = path.join(ROOT, 'infra', 'sam', 'template.yaml');
const TEMPLATE_BUILD = path.join(ROOT, '.aws-sam', 'build', 'template.yaml');

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

function samDeploy(certArn, hostedZoneId, apiHostname) {
  const overrides = [
    `Stage=${STAGE}`,
    `CertificateArn=${certArn}`,
    `HostedZoneId=${hostedZoneId}`,
    `ApiHostname=${apiHostname}`,
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

function mergeDeploymentInfo(outputs, apiHostname, usedSamDomain) {
  const deploymentInfoPath = path.join(ROOT, 'deployment-info.json');
  if (!fs.existsSync(deploymentInfoPath)) {
    throw new Error('deployment-info.json missing — run prepare-deployment first');
  }
  const di = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf8'));
  const apiId = outputs.RestApiId;
  const apiUrl = outputs.ApiUrl;

  di.backend = di.backend || {};
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

function runOptionalScriptDomainSetup() {
  console.log('🌐 Running setup-api-custom-domain.js (no regional cert in env for SAM stack)');
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
  const hostedZoneId = (process.env.ROUTE53_HOSTED_ZONE_ID || '').trim();
  const usedSamDomain = Boolean(certArn);

  if (usedSamDomain && !hostedZoneId) {
    console.log(
      '⚠️ API_GATEWAY_REGIONAL_CERTIFICATE_ARN is set but ROUTE53_HOSTED_ZONE_ID is empty — SAM will create the custom domain and mapping but not the Route53 alias; add the DNS record manually or set the hosted zone secret.'
    );
  }

  pruneLegacyApisIfNeeded(apiHostname);
  samBuild();
  samDeploy(certArn, hostedZoneId, apiHostname);

  const outputs = readStackOutputs();
  mergeDeploymentInfo(outputs, apiHostname, usedSamDomain);

  if (!usedSamDomain) {
    runOptionalScriptDomainSetup();
  }

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
