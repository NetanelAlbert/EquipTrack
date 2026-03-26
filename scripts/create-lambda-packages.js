#!/usr/bin/env node
const fs = require('fs');
const pathMod = require('path');
const { execSync } = require('child_process');

const BACKEND_DIST_PATH = 'dist/apps/backend';
const PACKAGES_DIR = 'lambda-packages';
/** One zip for all handler Lambdas; handler chosen via LAMBDA_HANDLER_KEY env at runtime */
const SHARED_BUNDLE_ZIP = 'shared-lambda-bundle.zip';

const SHARED_BUNDLE_DIR = pathMod.join(PACKAGES_DIR, '_shared_bundle');

function getHandlerNames() {
  console.log('📖 Loading handler names from endpoints config...');

  if (!fs.existsSync('endpoints-config.json')) {
    throw new Error('❌ endpoints-config.json not found. Run "node scripts/prepare-deployment.js" first.');
  }

  try {
    const config = JSON.parse(fs.readFileSync('endpoints-config.json', 'utf8'));
    console.log(`✅ Loaded ${config.handlerNames.length} handler names from config`);
    return config.handlerNames;
  } catch (error) {
    throw new Error(`❌ Failed to read endpoints-config.json: ${error.message}`);
  }
}

async function createLambdaPackages() {
  console.log('Creating Lambda deployment packages (single shared zip for all functions)...');

  if (fs.existsSync(PACKAGES_DIR)) {
    execSync(`rm -rf ${PACKAGES_DIR}`, { stdio: 'inherit' });
  }
  fs.mkdirSync(PACKAGES_DIR, { recursive: true });

  if (!fs.existsSync(BACKEND_DIST_PATH)) {
    throw new Error(`❌ Backend build not found at ${BACKEND_DIST_PATH}. Run nx build backend first.`);
  }

  const handlerNames = getHandlerNames();
  const handlerListJson = JSON.stringify(handlerNames);

  fs.mkdirSync(SHARED_BUNDLE_DIR, { recursive: true });
  execSync(`cp -a ${BACKEND_DIST_PATH}/. ${SHARED_BUNDLE_DIR}/`, { stdio: 'inherit' });
  console.log('📦 Installing production dependencies for the shared Lambda bundle...');
  execSync(`cd ${SHARED_BUNDLE_DIR} && npm install --omit=dev`, { stdio: 'inherit' });

  const handlerContent = `
const { lambdaHandlers } = require('./main');
const key = process.env.LAMBDA_HANDLER_KEY;
const allowed = new Set(${handlerListJson});
if (!key || typeof key !== 'string' || !allowed.has(key)) {
  const err = new Error(
    'LAMBDA_HANDLER_KEY must be set to a valid handler name (same keys as lambdaHandlers). Got: ' + String(key)
  );
  throw err;
}
const fn = lambdaHandlers[key];
if (typeof fn !== 'function') {
  throw new Error('lambdaHandlers[' + JSON.stringify(key) + '] is not a function');
}
exports.handler = fn;
`;

  fs.writeFileSync(pathMod.join(SHARED_BUNDLE_DIR, 'index.js'), handlerContent);

  const zipOut = pathMod.join(PACKAGES_DIR, SHARED_BUNDLE_ZIP);
  execSync(`cd "${SHARED_BUNDLE_DIR}" && zip -qr "../${SHARED_BUNDLE_ZIP}" .`, { stdio: 'inherit' });

  execSync(`rm -rf ${SHARED_BUNDLE_DIR}`, { stdio: 'inherit' });

  console.log(`✅ Created shared package ${zipOut} (${handlerNames.length} handlers via LAMBDA_HANDLER_KEY)`);
  console.log('All Lambda packages created successfully!');
}

if (require.main === module) {
  createLambdaPackages().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createLambdaPackages, getHandlerNames, SHARED_BUNDLE_ZIP };
