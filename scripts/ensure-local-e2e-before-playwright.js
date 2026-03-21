/**
 * Runs before Playwright local E2E: fast-fail when LocalStack is down (clear message),
 * otherwise runs setup-local-e2e.js so tables/secrets/S3/seed exist.
 *
 * Skip with E2E_SKIP_LOCAL_E2E_ENSURE=true (e.g. exotic CI layouts).
 */
const { execSync } = require('child_process');
const path = require('path');
const {
  DynamoDBClient,
  ListTablesCommand,
} = require('@aws-sdk/client-dynamodb');

const LOCALSTACK_ENDPOINT =
  process.env['AWS_ENDPOINT_URL'] || 'http://localhost:4566';
const MAX_ATTEMPTS = 8;
const POLL_MS = 400;

function awsClientConfig() {
  return {
    region: process.env['AWS_REGION'] || 'us-east-1',
    endpoint: LOCALSTACK_ENDPOINT,
    credentials: {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || 'test',
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || 'test',
    },
  };
}

async function isLocalstackReachable() {
  try {
    const response = await fetch(`${LOCALSTACK_ENDPOINT}/_localstack/health`, {
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok) {
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const client = new DynamoDBClient(awsClientConfig());
    await client.send(new ListTablesCommand({ Limit: 1 }));
    return true;
  } catch {
    return false;
  }
}

async function waitUntilReachable() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (await isLocalstackReachable()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return false;
}

async function main() {
  if (process.env['E2E_SKIP_LOCAL_E2E_ENSURE'] === 'true') {
    return;
  }

  const ok = await waitUntilReachable();
  if (!ok) {
    console.error(`[ensure-local-e2e] LocalStack is not reachable at ${LOCALSTACK_ENDPOINT}

Start the stack and provision data, then retry:

  npm run e2e:local:prepare

If the container is already running:

  npm run e2e:local:setup
`);
    process.exit(1);
  }

  const workspaceRoot = path.join(__dirname, '..');
  execSync('node scripts/setup-local-e2e.js', {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      STAGE: process.env['STAGE'] || 'local',
      AWS_REGION: process.env['AWS_REGION'] || 'us-east-1',
      AWS_ENDPOINT_URL: LOCALSTACK_ENDPOINT,
      AWS_ENDPOINT_URL_DYNAMODB:
        process.env['AWS_ENDPOINT_URL_DYNAMODB'] || LOCALSTACK_ENDPOINT,
      AWS_ENDPOINT_URL_S3: process.env['AWS_ENDPOINT_URL_S3'] || LOCALSTACK_ENDPOINT,
      AWS_ENDPOINT_URL_SECRETSMANAGER:
        process.env['AWS_ENDPOINT_URL_SECRETSMANAGER'] || LOCALSTACK_ENDPOINT,
      AWS_ACCESS_KEY_ID: process.env['AWS_ACCESS_KEY_ID'] || 'test',
      AWS_SECRET_ACCESS_KEY: process.env['AWS_SECRET_ACCESS_KEY'] || 'test',
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
