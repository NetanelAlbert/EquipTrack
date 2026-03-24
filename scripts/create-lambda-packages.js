#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKEND_DIST_PATH = 'dist/apps/backend';
const PACKAGES_DIR = 'lambda-packages';
/** Shared tree with a single npm install; each handler is a hardlink copy + entry index + zip */
const SHARED_BUNDLE_DIR = path.join(PACKAGES_DIR, '_shared_bundle');

const ZIP_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.LAMBDA_ZIP_CONCURRENCY || '8', 10) || 8
);

/**
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} mapper
 * @returns {Promise<R[]>}
 */
async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) break;
      results[i] = await mapper(items[i], i);
    }
  };

  const n = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

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

function copyTreeWithHardlinksPrefered(src, dest) {
  try {
    execSync(`mkdir -p "${dest}" && cp -al "${src}/." "${dest}/"`, { stdio: 'inherit' });
  } catch {
    console.log('ℹ️ Hardlink copy failed (e.g. cross-device); falling back to full copy');
    execSync(`mkdir -p "${dest}" && cp -a "${src}/." "${dest}/"`, { stdio: 'inherit' });
  }
}

async function createLambdaPackages() {
  console.log('Creating Lambda deployment packages...');

  if (fs.existsSync(PACKAGES_DIR)) {
    execSync(`rm -rf ${PACKAGES_DIR}`, { stdio: 'inherit' });
  }
  fs.mkdirSync(PACKAGES_DIR, { recursive: true });

  if (!fs.existsSync(BACKEND_DIST_PATH)) {
    throw new Error(`❌ Backend build not found at ${BACKEND_DIST_PATH}. Run nx build backend first.`);
  }

  fs.mkdirSync(SHARED_BUNDLE_DIR, { recursive: true });
  execSync(`cp -a ${BACKEND_DIST_PATH}/. ${SHARED_BUNDLE_DIR}/`, { stdio: 'inherit' });
  console.log('📦 Installing production dependencies once for all Lambda bundles...');
  execSync(`cd ${SHARED_BUNDLE_DIR} && npm install --omit=dev`, { stdio: 'inherit' });

  const handlerNames = getHandlerNames();

  console.log(
    `📦 Building ${handlerNames.length} handler trees (zip concurrency ${ZIP_CONCURRENCY})...`
  );

  for (const handlerName of handlerNames) {
    console.log(`Creating tree for ${handlerName}...`);
    const packageDir = path.join(PACKAGES_DIR, handlerName);
    fs.mkdirSync(packageDir, { recursive: true });
    copyTreeWithHardlinksPrefered(SHARED_BUNDLE_DIR, packageDir);

    const handlerContent = `
const { lambdaHandlers } = require('./main');

exports.handler = lambdaHandlers.${handlerName};
`;

    fs.writeFileSync(path.join(packageDir, 'index.js'), handlerContent);
  }

  await mapWithConcurrency(handlerNames, ZIP_CONCURRENCY, async (handlerName) => {
    const packageDir = path.join(PACKAGES_DIR, handlerName);
    execSync(`cd ${packageDir} && zip -qr ../${handlerName}.zip .`, { stdio: 'inherit' });
    console.log(`✅ Created ${handlerName}.zip`);
  });

  execSync(`rm -rf ${SHARED_BUNDLE_DIR}`, { stdio: 'inherit' });

  console.log('All Lambda packages created successfully!');
}

if (require.main === module) {
  createLambdaPackages().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createLambdaPackages, getHandlerNames };
