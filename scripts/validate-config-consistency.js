#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Environment Configuration Consistency Validator
 * 
 * Validates that all deployment scripts use consistent default values
 * for AWS_REGION and STAGE environment variables.
 * 
 * This prevents deployment conflicts caused by inconsistent defaults.
 */

const EXPECTED_DEFAULTS = {
  AWS_REGION: 'il-central-1',
  STAGE: 'dev'
};

const SCRIPTS_DIR = './scripts';
const SCRIPT_FILES = fs.readdirSync(SCRIPTS_DIR)
  .filter(file => file.endsWith('.js') && file !== 'validate-config-consistency.js');

console.log('🔍 Validating environment configuration consistency...\n');

let hasErrors = false;
const results = [];

function validateScript(scriptFile) {
  const filePath = path.join(SCRIPTS_DIR, scriptFile);
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {
    file: scriptFile,
    issues: [],
    awsRegion: null,
    stage: null
  };

  // Check AWS_REGION default
  const awsRegionMatch = content.match(/AWS_REGION\s*=\s*process\.env\.AWS_REGION\s*\|\|\s*['"`]([^'"`]+)['"`]/);
  if (awsRegionMatch) {
    result.awsRegion = awsRegionMatch[1];
    if (result.awsRegion !== EXPECTED_DEFAULTS.AWS_REGION) {
      result.issues.push(`AWS_REGION default is '${result.awsRegion}', expected '${EXPECTED_DEFAULTS.AWS_REGION}'`);
      hasErrors = true;
    }
  } else if (content.includes('AWS_REGION')) {
    result.issues.push('AWS_REGION found but default pattern not detected');
    hasErrors = true;
  }

  // Check STAGE default
  const stageMatch = content.match(/STAGE\s*=\s*process\.env\.STAGE\s*\|\|\s*['"`]([^'"`]+)['"`]/);
  if (stageMatch) {
    result.stage = stageMatch[1];
    if (result.stage !== EXPECTED_DEFAULTS.STAGE) {
      result.issues.push(`STAGE default is '${result.stage}', expected '${EXPECTED_DEFAULTS.STAGE}'`);
      hasErrors = true;
    }
  } else if (content.includes('STAGE')) {
    result.issues.push('STAGE found but default pattern not detected');
    hasErrors = true;
  }

  return result;
}

// Validate all scripts
SCRIPT_FILES.forEach(scriptFile => {
  const result = validateScript(scriptFile);
  results.push(result);

  if (result.issues.length > 0) {
    console.log(`❌ ${scriptFile}:`);
    result.issues.forEach(issue => console.log(`   - ${issue}`));
  } else if (result.awsRegion || result.stage) {
    console.log(`✅ ${scriptFile}: AWS_REGION=${result.awsRegion || 'N/A'}, STAGE=${result.stage || 'N/A'}`);
  } else {
    console.log(`ℹ️  ${scriptFile}: No environment variables found`);
  }
});

// Summary
console.log('\n📊 Summary:');
console.log(`   - Scripts checked: ${SCRIPT_FILES.length}`);
console.log(`   - Issues found: ${results.filter(r => r.issues.length > 0).length}`);
console.log(`   - Expected AWS_REGION: ${EXPECTED_DEFAULTS.AWS_REGION}`);
console.log(`   - Expected STAGE: ${EXPECTED_DEFAULTS.STAGE}`);

if (hasErrors) {
  console.log('\n💥 Configuration inconsistencies detected!');
  console.log('Please fix the issues above to ensure reliable deployments.');
  process.exit(1);
} else {
  console.log('\n🎉 All configuration defaults are consistent!');
  console.log('Deployment scripts are properly aligned.');
  process.exit(0);
} 