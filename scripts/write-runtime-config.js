const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_API_URL =
  process.env.RUNTIME_API_URL || 'http://localhost:3000';

function isFeaturePreviewLoginEnabled() {
  return (
    String(process.env.RUNTIME_FEATURE_PREVIEW_LOGIN || '').toLowerCase() ===
    'true'
  );
}

function isSameOriginApi() {
  return (
    String(process.env.RUNTIME_USE_SAME_ORIGIN_FOR_API || '').toLowerCase() ===
    'true'
  );
}

/**
 * @param {string} apiUrl
 * @returns {Record<string, unknown>}
 */
function buildRuntimeConfigObject(apiUrl) {
  if (isSameOriginApi()) {
    return {
      useSameOriginForApi: true,
      ...(isFeaturePreviewLoginEnabled()
        ? { featurePreviewLoginEnabled: true }
        : {}),
    };
  }
  const url = (apiUrl || DEFAULT_API_URL).trim() || DEFAULT_API_URL;
  return {
    apiUrl: url,
    ...(isFeaturePreviewLoginEnabled()
      ? { featurePreviewLoginEnabled: true }
      : {}),
  };
}

/**
 * @param {string} outputPath
 * @param {string} [apiUrl]
 */
function writeRuntimeConfigFile(outputPath, apiUrl) {
  const obj = buildRuntimeConfigObject(apiUrl ?? DEFAULT_API_URL);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(obj, null, 2)}\n`, 'utf-8');
  const apiInfo = obj.useSameOriginForApi
    ? 'same-origin-api'
    : `apiUrl=${obj.apiUrl}`;
  console.log(
    `[write-runtime-config] wrote ${outputPath} ${apiInfo} featurePreviewLogin=${Boolean(obj.featurePreviewLoginEnabled)}`
  );
}

/**
 * Upload runtime-config.json to an S3 bucket (PR preview / post-deploy refresh).
 * @param {string} bucketName
 * @param {string} [apiUrl]
 */
function syncRuntimeConfigToS3(bucketName, apiUrl) {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rtcfg-'));
  const tmpFile = path.join(tmpDir, 'runtime-config.json');
  writeRuntimeConfigFile(tmpFile, apiUrl);
  try {
    execFileSync(
      'aws',
      [
        's3',
        'cp',
        tmpFile,
        `s3://${bucketName}/assets/runtime-config.json`,
        '--cache-control',
        'no-cache,no-store,must-revalidate',
        '--content-type',
        'application/json',
      ],
      { stdio: 'inherit' }
    );
  } finally {
    fs.unlinkSync(tmpFile);
    fs.rmdirSync(tmpDir);
  }
}

function defaultProjectRuntimeConfigPath() {
  return path.join(
    __dirname,
    '..',
    'apps',
    'frontend',
    'src',
    'assets',
    'runtime-config.json'
  );
}

if (require.main === module) {
  const cliApiUrl = process.argv[2] || DEFAULT_API_URL;
  writeRuntimeConfigFile(defaultProjectRuntimeConfigPath(), cliApiUrl);
}

/**
 * Prefer explicit RUNTIME_API_URL, then custom API HTTPS URL from deployment-info, then execute-api URL.
 * @param {Record<string, unknown>} [deploymentInfo]
 * @returns {string}
 */
function resolveRuntimeApiUrl(deploymentInfo) {
  const fromEnv = (process.env.RUNTIME_API_URL || '').trim();
  if (fromEnv) {
    return fromEnv;
  }
  const custom =
    deploymentInfo?.backend?.apiGateway?.customApiUrl ||
    deploymentInfo?.backend?.apiGateway?.customDomain;
  if (typeof custom === 'string' && custom.trim()) {
    return custom.trim().replace(/\/$/, '');
  }
  const apiUrl = deploymentInfo?.api?.apiUrl;
  if (typeof apiUrl === 'string' && apiUrl.trim()) {
    return apiUrl.trim().replace(/\/$/, '');
  }
  return '';
}

module.exports = {
  buildRuntimeConfigObject,
  writeRuntimeConfigFile,
  syncRuntimeConfigToS3,
  defaultProjectRuntimeConfigPath,
  resolveRuntimeApiUrl,
};
