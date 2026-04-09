const fs = require('fs');
const path = require('path');

const apiUrl = process.argv[2] || process.env.RUNTIME_API_URL || 'http://localhost:3000';
const runtimeConfigPath = path.join(
  __dirname,
  '..',
  'apps',
  'frontend',
  'src',
  'assets',
  'runtime-config.json'
);

function useSameOriginForApi() {
  return (
    String(process.env.RUNTIME_USE_SAME_ORIGIN_FOR_API || '').toLowerCase() ===
    'true'
  );
}

const payload = useSameOriginForApi()
  ? { useSameOriginForApi: true }
  : { apiUrl };

const content = JSON.stringify(payload, null, 2);

fs.writeFileSync(runtimeConfigPath, `${content}\n`, 'utf-8');
if (useSameOriginForApi()) {
  console.log('[write-runtime-config] useSameOriginForApi=true (API via /api on current host)');
} else {
  console.log(`[write-runtime-config] runtime apiUrl set to ${apiUrl}`);
}
