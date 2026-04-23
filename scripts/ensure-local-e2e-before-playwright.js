/**
 * Runs before Playwright local E2E:
 * - Probes LocalStack; if down, runs `docker compose up -d localstack` (same as e2e:local:stack:up)
 * - Waits until LocalStack answers, then runs setup-local-e2e.js (tables/secrets/S3/seed).
 *
 * E2E_SKIP_LOCAL_E2E_ENSURE=true — skip entirely (CI after prepare, e2e:local:test).
 * E2E_SKIP_LOCALSTACK_AUTO_UP=true — do not run docker compose (only probe + setup).
 */
const { execSync } = require('child_process');
const path = require('path');
const {
  DynamoDBClient,
  ListTablesCommand,
} = require('@aws-sdk/client-dynamodb');

const workspaceRoot = path.join(__dirname, '..');
const LOCALSTACK_ENDPOINT =
  process.env['AWS_ENDPOINT_URL'] || 'http://localhost:4566';

const PROBE_ATTEMPTS = 8;
const PROBE_MS = 400;
/** After `docker compose up`, cold LocalStack can take a while to pass health checks. */
const POST_UP_ATTEMPTS = 90;
const POST_UP_MS = 500;

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

async function waitUntilReachable(maxAttempts, pollMs) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await isLocalstackReachable()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return false;
}

function tryStartLocalstack() {
  if (process.env['E2E_SKIP_LOCALSTACK_AUTO_UP'] === 'true') {
    return false;
  }
  try {
    execSync('bash scripts/docker-compose-up-localstack.sh', {
      cwd: workspaceRoot,
      stdio: 'inherit',
    });
    console.log(
      '[ensure-local-e2e] LocalStack container start requested (docker compose)'
    );
    return true;
  } catch {
    console.error(
      '[ensure-local-e2e] docker compose failed (is Docker running and compose v2 available?)'
    );
    return false;
  }
}

async function main() {
  if (process.env['E2E_SKIP_LOCAL_E2E_ENSURE'] === 'true') {
    return;
  }

  let ok = await waitUntilReachable(PROBE_ATTEMPTS, PROBE_MS);
  if (!ok) {
    console.log(
      '[ensure-local-e2e] LocalStack not reachable yet; trying to start the stack…'
    );
    const started = tryStartLocalstack();
    if (started) {
      ok = await waitUntilReachable(POST_UP_ATTEMPTS, POST_UP_MS);
    }
  }

  if (!ok) {
    console.error(`[ensure-local-e2e] LocalStack is not reachable at ${LOCALSTACK_ENDPOINT}

If Docker is running, start LocalStack manually:

  npm run e2e:local:stack:up

Then provision:

  npm run e2e:local:setup

Or in one step:

  npm run e2e:local:prepare
`);
    process.exit(1);
  }

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
