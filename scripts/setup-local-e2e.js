const { generateKeyPairSync } = require('crypto');
const {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} = require('@aws-sdk/client-s3');
const {
  SecretsManagerClient,
  CreateSecretCommand,
  PutSecretValueCommand,
  ListSecretsCommand,
} = require('@aws-sdk/client-secrets-manager');
const {
  DynamoDBClient,
  ListTablesCommand,
} = require('@aws-sdk/client-dynamodb');
const { TableCreator } = require('./create-dynamodb-tables');
const { seedE2eData } = require('./seed-e2e-data');

const LOCALSTACK_ENDPOINT = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const STAGE = process.env.STAGE || 'local';
const FORMS_BUCKET = process.env.E2E_FORMS_BUCKET || 'equip-track-forms';

function awsClientConfig() {
  return {
    region: AWS_REGION,
    endpoint: LOCALSTACK_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  };
}

function isReadyState(value) {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return (
      normalized === 'running' ||
      normalized === 'available' ||
      normalized === 'ready' ||
      normalized === 'initialized'
    );
  }

  if (value && typeof value === 'object') {
    return isReadyState(value.status || value.state);
  }

  return false;
}

function isHealthReady(healthPayload) {
  if (!healthPayload || typeof healthPayload !== 'object') {
    return false;
  }

  const services = healthPayload.services || {};
  const dynamodbReady = isReadyState(services.dynamodb);
  const s3Ready = isReadyState(services.s3);
  const secretsReady = isReadyState(services.secretsmanager);

  return dynamodbReady && s3Ready && secretsReady;
}

async function isDynamoReachable() {
  const client = new DynamoDBClient(awsClientConfig());
  try {
    await client.send(new ListTablesCommand({ Limit: 1 }));
    return true;
  } catch {
    return false;
  }
}

async function isSecretsManagerReachable() {
  const client = new SecretsManagerClient(awsClientConfig());
  try {
    await client.send(new ListSecretsCommand({ MaxResults: 1 }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Single check — no polling. Callers must start LocalStack first (e.g. docker compose up --wait).
 * Fails fast with exit 1 via main().catch when LocalStack or required services are not usable.
 */
async function assertLocalstackReady() {
  const healthUrl = `${LOCALSTACK_ENDPOINT}/_localstack/health`;
  let lastHealthStatus;
  let lastHealthPayload;

  try {
    const response = await fetch(healthUrl);
    lastHealthStatus = response.status;
    if (response.ok) {
      const body = await response.json();
      lastHealthPayload = body;
      if (isHealthReady(body)) {
        console.log('[setup-local-e2e] LocalStack is ready');
        return;
      }
    }
  } catch {
    // Health URL may be unavailable; try API probes below.
  }

  // Health JSON shapes differ across LocalStack versions — require DynamoDB + Secrets Manager.
  if ((await isDynamoReachable()) && (await isSecretsManagerReachable())) {
    console.log(
      '[setup-local-e2e] LocalStack reachable via DynamoDB + Secrets Manager (health format fallback)'
    );
    return;
  }

  const compactPayload = lastHealthPayload
    ? JSON.stringify(lastHealthPayload)
    : 'none';
  throw new Error(
    `LocalStack is not ready at ${LOCALSTACK_ENDPOINT} (healthStatus=${lastHealthStatus ?? 'n/a'}, healthPayload=${compactPayload}). ` +
      'DynamoDB and Secrets Manager must both respond. Ensure the container is running and healthy before setup ' +
      '(e.g. npm run e2e:local:stack:up uses docker compose --wait).'
  );
}

async function ensureFormsBucket() {
  const s3 = new S3Client({
    ...awsClientConfig(),
    forcePathStyle: true,
  });

  try {
    await s3.send(new HeadBucketCommand({ Bucket: FORMS_BUCKET }));
    console.log(`[setup-local-e2e] S3 bucket exists: ${FORMS_BUCKET}`);
    return;
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: FORMS_BUCKET }));
    console.log(`[setup-local-e2e] Created S3 bucket: ${FORMS_BUCKET}`);
  }
}

async function upsertSecret(client, secretName, value) {
  try {
    await client.send(
      new CreateSecretCommand({
        Name: secretName,
        SecretString: value,
      })
    );
    console.log(`[setup-local-e2e] Created secret: ${secretName}`);
  } catch (error) {
    if (error?.name === 'ResourceExistsException') {
      await client.send(
        new PutSecretValueCommand({
          SecretId: secretName,
          SecretString: value,
        })
      );
      console.log(`[setup-local-e2e] Updated secret: ${secretName}`);
      return;
    }
    throw error;
  }
}

async function ensureJwtSecrets() {
  console.log('[setup-local-e2e] Ensuring JWT key secrets in Secrets Manager...');
  const secretsClient = new SecretsManagerClient(awsClientConfig());
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  await upsertSecret(secretsClient, 'equip-track/jwt-private-key', privateKey);
  await upsertSecret(secretsClient, 'equip-track/jwt-public-key', publicKey);
}

async function main() {
  process.env.STAGE = STAGE;
  process.env.AWS_REGION = AWS_REGION;
  process.env.AWS_ENDPOINT_URL = LOCALSTACK_ENDPOINT;
  process.env.AWS_ENDPOINT_URL_DYNAMODB =
    process.env.AWS_ENDPOINT_URL_DYNAMODB || LOCALSTACK_ENDPOINT;
  process.env.AWS_ENDPOINT_URL_S3 =
    process.env.AWS_ENDPOINT_URL_S3 || LOCALSTACK_ENDPOINT;
  process.env.AWS_ENDPOINT_URL_SECRETSMANAGER =
    process.env.AWS_ENDPOINT_URL_SECRETSMANAGER || LOCALSTACK_ENDPOINT;
  process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test';
  process.env.AWS_SECRET_ACCESS_KEY =
    process.env.AWS_SECRET_ACCESS_KEY || 'test';

  console.log(
    `[setup-local-e2e] endpoint=${LOCALSTACK_ENDPOINT}, region=${AWS_REGION}, stage=${STAGE}`
  );

  await assertLocalstackReady();
  await ensureFormsBucket();
  await ensureJwtSecrets();

  const tableCreator = new TableCreator({
    stage: STAGE,
    region: AWS_REGION,
    endpoint: LOCALSTACK_ENDPOINT,
  });
  await tableCreator.createTables();
  await seedE2eData();

  console.log('[setup-local-e2e] Local E2E infrastructure is ready');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[setup-local-e2e] Failed:', error);
    process.exit(1);
  });
}
