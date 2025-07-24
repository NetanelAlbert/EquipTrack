#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKEND_DIST_PATH = 'dist/apps/backend';
const PACKAGES_DIR = 'lambda-packages';

function getHandlerNames() {
  console.log('📖 Loading handler names from endpoints config...');
  
  // Read from endpoints-config.json created by prepare script
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

function createLambdaPackages() {
  console.log('Creating Lambda deployment packages...');
  
  // Clean up existing packages directory
  if (fs.existsSync(PACKAGES_DIR)) {
    execSync(`rm -rf ${PACKAGES_DIR}`, { stdio: 'inherit' });
  }
  fs.mkdirSync(PACKAGES_DIR, { recursive: true });

  const handlerNames = getHandlerNames();
  
  handlerNames.forEach(handlerName => {
    console.log(`Creating package for ${handlerName}...`);
    
    const packageDir = path.join(PACKAGES_DIR, handlerName);
    fs.mkdirSync(packageDir, { recursive: true });
    
    // Copy the entire built backend to each package
    execSync(`cp -r ${BACKEND_DIST_PATH}/* ${packageDir}/`, { stdio: 'inherit' });
    
    // Install dependencies in the package directory for external modules
    execSync(`cd ${packageDir} && npm install --only=production`, { stdio: 'inherit' });
    
    // Create the specific handler entry point
    const handlerContent = `
const { lambdaHandlers } = require('./main');

exports.handler = lambdaHandlers.${handlerName};
`;
    
    fs.writeFileSync(path.join(packageDir, 'index.js'), handlerContent);
    
    // Create deployment zip
    const zipPath = path.join(PACKAGES_DIR, `${handlerName}.zip`);
    execSync(`cd ${packageDir} && zip -r ../${handlerName}.zip .`, { stdio: 'inherit' });
    
    console.log(`✅ Created ${handlerName}.zip`);
  });
  
  console.log('All Lambda packages created successfully!');
}

if (require.main === module) {
  createLambdaPackages();
}

module.exports = { createLambdaPackages, getHandlerNames }; 