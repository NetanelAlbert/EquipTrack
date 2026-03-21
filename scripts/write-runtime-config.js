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

const content = JSON.stringify(
  {
    apiUrl,
  },
  null,
  2
);

fs.writeFileSync(runtimeConfigPath, `${content}\n`, 'utf-8');
console.log(`[write-runtime-config] runtime apiUrl set to ${apiUrl}`);
