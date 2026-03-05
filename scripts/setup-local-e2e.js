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
} = require('@aws-sdk/client-secrets-manager');
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

async function waitForLocalstack(maxAttempts = 30) {
  const healthUrl = `${LOCALSTACK_ENDPOINT}/_localstack/health`;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        const body = await response.json();
        if (body?.services?.dynamodb === 'running') {
          console.log('[setup-local-e2e] LocalStack is ready');
          return;
        }
      }
    } catch {
      // Keep polling until ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('LocalStack did not become ready in time');
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

  await waitForLocalstack();
  await ensureFormsBucket();
  await ensureJwtSecrets();

  const tableCreator = new TableCreator();
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
