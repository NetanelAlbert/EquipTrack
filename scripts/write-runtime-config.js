const fs = require('fs');
const path = require('path');

const pathSegment = (process.env.PREVIEW_PATH_SEGMENT || '').trim();
const publicOrigin = (process.env.PREVIEW_PUBLIC_ORIGIN || '').trim();

let apiUrl;
if (pathSegment && publicOrigin) {
  const base = publicOrigin.replace(/\/$/, '');
  apiUrl = `${base}/${pathSegment}`;
} else {
  apiUrl =
    process.argv[2] || process.env.RUNTIME_API_URL || 'http://localhost:3000';
}

const featurePreviewLoginEnabled =
  process.env.FEATURE_PREVIEW_LOGIN_ENABLED === 'true' ||
  process.env.FEATURE_PREVIEW_LOGIN_ENABLED === '1';

const runtimeConfigPath = path.join(
  __dirname,
  '..',
  'apps',
  'frontend',
  'src',
  'assets',
  'runtime-config.json'
);

/** @type {{ apiUrl: string; featurePreviewLoginEnabled?: boolean }} */
const payload = { apiUrl };
if (featurePreviewLoginEnabled) {
  payload.featurePreviewLoginEnabled = true;
}

const content = JSON.stringify(payload, null, 2);

fs.writeFileSync(runtimeConfigPath, `${content}\n`, 'utf-8');
console.log(
  `[write-runtime-config] wrote ${runtimeConfigPath} apiUrl=${apiUrl} featurePreviewLoginEnabled=${Boolean(payload.featurePreviewLoginEnabled)} pathSegment=${pathSegment || '(none)'}`
);
