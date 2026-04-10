#!/usr/bin/env node
/**
 * Tear down AWS resources for a PR preview stage (STAGE=pr-<number>).
 * Deletes: API SAM stack, frontend S3 bucket, lambda code bucket, DynamoDB tables, Route53 preview hostname.
 *
 * Env: STAGE (required, must match /^pr-\d+$/i), AWS_REGION, BASE_DOMAIN (default equip-track.com)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

process.env.AWS_PAGER = '';

const STAGE = (process.env.STAGE || '').trim();
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'equip-track.com';

if (!/^pr-\d+$/i.test(STAGE)) {
  console.error(
    '[pr-preview-teardown] STAGE must match pr-<number> (got:',
    STAGE,
    ')'
  );
  process.exit(1);
}

const STACK_NAME = `equip-track-api-stack-${STAGE}`;
const FRONTEND_BUCKET = `equip-track-frontend-${STAGE}`;
const LAMBDA_BUCKET = `equip-track-lambda-code-${STAGE}`;
const TABLE_BASES = [
  'UsersAndOrganizations',
  'Inventory',
  'Forms',
  'EquipTrackReport',
];
const PREVIEW_HOSTNAME = `${STAGE}.${BASE_DOMAIN}`;

function aws(args) {
  execFileSync('aws', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function tryAws(args) {
  try {
    return execFileSync('aws', args, { encoding: 'utf8' });
  } catch {
    return null;
  }
}

function emptyBucket(bucket) {
  const head = tryAws(['s3api', 'head-bucket', '--bucket', bucket]);
  if (head === null) {
    console.log(`[pr-preview-teardown] Bucket not found (skip): ${bucket}`);
    return;
  }
  console.log(`[pr-preview-teardown] Emptying s3://${bucket}`);
  tryAws(['s3', 'rm', `s3://${bucket}/`, '--recursive']);
  try {
    aws(['s3api', 'delete-bucket', '--bucket', bucket]);
    console.log(`[pr-preview-teardown] Deleted bucket ${bucket}`);
  } catch (e) {
    console.warn(`[pr-preview-teardown] Could not delete bucket ${bucket}:`, e.message);
  }
}

function deleteStack() {
  const exists = tryAws([
    'cloudformation',
    'describe-stacks',
    '--stack-name',
    STACK_NAME,
    '--region',
    AWS_REGION,
    '--output',
    'json',
  ]);
  if (!exists) {
    console.log(`[pr-preview-teardown] Stack not found (skip): ${STACK_NAME}`);
    return;
  }
  console.log(`[pr-preview-teardown] Deleting stack ${STACK_NAME}`);
  aws([
    'cloudformation',
    'delete-stack',
    '--stack-name',
    STACK_NAME,
    '--region',
    AWS_REGION,
  ]);
  aws([
    'cloudformation',
    'wait',
    'stack-delete-complete',
    '--stack-name',
    STACK_NAME,
    '--region',
    AWS_REGION,
  ]);
  console.log(`[pr-preview-teardown] Stack deleted: ${STACK_NAME}`);
}

function deleteTables() {
  for (const base of TABLE_BASES) {
    const name = `${base}-${STAGE}`;
    const out = tryAws([
      'dynamodb',
      'describe-table',
      '--table-name',
      name,
      '--region',
      AWS_REGION,
      '--output',
      'json',
    ]);
    if (!out) {
      console.log(`[pr-preview-teardown] DynamoDB table not found (skip): ${name}`);
      continue;
    }
    console.log(`[pr-preview-teardown] Deleting DynamoDB table ${name}`);
    aws(['dynamodb', 'delete-table', '--table-name', name, '--region', AWS_REGION]);
    try {
      aws([
        'dynamodb',
        'wait',
        'table-not-exists',
        '--table-name',
        name,
        '--region',
        AWS_REGION,
      ]);
    } catch {
      console.warn(`[pr-preview-teardown] Wait for table delete timed or failed: ${name}`);
    }
  }
}

function stripHostedZoneId(id) {
  if (!id) return id;
  return String(id).replace(/^\/hostedzone\//, '');
}

function deleteDnsRecord() {
  const zonesOut = tryAws([
    'route53',
    'list-hosted-zones-by-name',
    '--dns-name',
    BASE_DOMAIN,
    '--output',
    'json',
  ]);
  if (!zonesOut) {
    console.log('[pr-preview-teardown] Could not list hosted zones (skip DNS)');
    return;
  }
  const zones = JSON.parse(zonesOut).HostedZones || [];
  const hostedZone = zones.find((z) => z.Name === `${BASE_DOMAIN}.`);
  if (!hostedZone) {
    console.log(`[pr-preview-teardown] No hosted zone for ${BASE_DOMAIN} (skip DNS)`);
    return;
  }
  const zoneId = stripHostedZoneId(hostedZone.Id);
  const recordName = PREVIEW_HOSTNAME.endsWith('.')
    ? PREVIEW_HOSTNAME
    : `${PREVIEW_HOSTNAME}.`;
  const listOut = tryAws([
    'route53',
    'list-resource-record-sets',
    '--hosted-zone-id',
    zoneId,
    '--output',
    'json',
  ]);
  if (!listOut) return;
  const records = JSON.parse(listOut).ResourceRecordSets || [];
  const toDelete = records.filter(
    (r) =>
      String(r.Name).toLowerCase() === recordName.toLowerCase() &&
      r.Type === 'A'
  );
  if (toDelete.length === 0) {
    console.log(`[pr-preview-teardown] No A record at ${recordName} (skip DNS)`);
    return;
  }
  const batch = {
    Changes: toDelete.map((ResourceRecordSet) => ({
      Action: 'DELETE',
      ResourceRecordSet,
    })),
  };
  fs.writeFileSync('pr-preview-dns-delete.json', JSON.stringify(batch));
  try {
    aws([
      'route53',
      'change-resource-record-sets',
      '--hosted-zone-id',
      zoneId,
      '--change-batch',
      'file://pr-preview-dns-delete.json',
    ]);
    console.log(`[pr-preview-teardown] Removed DNS A record(s) for ${PREVIEW_HOSTNAME}`);
  } finally {
    fs.unlinkSync('pr-preview-dns-delete.json');
  }
}

function main() {
  console.log(`[pr-preview-teardown] STAGE=${STAGE} region=${AWS_REGION}`);
  deleteStack();
  deleteTables();
  emptyBucket(FRONTEND_BUCKET);
  emptyBucket(LAMBDA_BUCKET);
  deleteDnsRecord();
  console.log('[pr-preview-teardown] Done');
}

main();
