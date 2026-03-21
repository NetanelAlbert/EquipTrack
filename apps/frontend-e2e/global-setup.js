const { execSync } = require('child_process');
const path = require('path');

/**
 * Ensures LocalStack tables/secrets/S3 and E2E seed data exist before Playwright
 * starts the app servers. Skips when SKIP_E2E_GLOBAL_SETUP=true (e.g. CI already
 * ran `npm run e2e:local:prepare`).
 */
module.exports = async function globalSetup() {
  if (process.env['SKIP_E2E_GLOBAL_SETUP'] === 'true') {
    return;
  }

  const workspaceRoot = path.join(__dirname, '../..');
  execSync('node scripts/setup-local-e2e.js', {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      STAGE: process.env['STAGE'] || 'local',
      AWS_REGION: process.env['AWS_REGION'] || 'us-east-1',
      AWS_ENDPOINT_URL:
        process.env['AWS_ENDPOINT_URL'] || 'http://localhost:4566',
      AWS_ENDPOINT_URL_DYNAMODB:
        process.env['AWS_ENDPOINT_URL_DYNAMODB'] ||
        process.env['AWS_ENDPOINT_URL'] ||
        'http://localhost:4566',
      AWS_ACCESS_KEY_ID: process.env['AWS_ACCESS_KEY_ID'] || 'test',
      AWS_SECRET_ACCESS_KEY: process.env['AWS_SECRET_ACCESS_KEY'] || 'test',
    },
  });
};
