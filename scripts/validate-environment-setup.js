#!/usr/bin/env node
const fs = require('fs');

/**
 * GitHub Environment Setup Validator
 * 
 * Validates that the deployment pipeline is properly configured
 * for GitHub environments with appropriate separation.
 */

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const GITHUB_REF = process.env.GITHUB_REF || 'refs/heads/develop';
const GITHUB_ENVIRONMENT = process.env.GITHUB_ENVIRONMENT;

console.log('🔍 Validating GitHub Environment Setup...\n');

// Environment Detection
const isProduction = STAGE === 'production' || GITHUB_REF.startsWith('refs/tags/v');
const expectedEnvironment = isProduction ? 'production' : 'development';

console.log('📊 Current Configuration:');
console.log(`   STAGE: ${STAGE}`);
console.log(`   AWS_REGION: ${AWS_REGION}`);
console.log(`   GITHUB_REF: ${GITHUB_REF}`);
console.log(`   GITHUB_ENVIRONMENT: ${GITHUB_ENVIRONMENT || 'Not set (legacy mode)'}`);
console.log(`   Expected Environment: ${expectedEnvironment}\n`);

const issues = [];
const warnings = [];

// Validate Environment Assignment
if (GITHUB_ENVIRONMENT) {
  if (GITHUB_ENVIRONMENT !== expectedEnvironment) {
    issues.push(`Environment mismatch: Using '${GITHUB_ENVIRONMENT}' but expected '${expectedEnvironment}'`);
  } else {
    console.log('✅ GitHub Environment correctly assigned');
  }
} else {
  warnings.push('GitHub Environment not detected - running in legacy mode');
  warnings.push('Consider migrating to GitHub Environments for better security');
}

// Validate AWS Region Consistency
if (AWS_REGION !== 'il-central-1') {
  issues.push(`AWS Region should be 'il-central-1', got '${AWS_REGION}'`);
} else {
  console.log('✅ AWS Region correctly configured');
}

// Validate Stage Assignment
if (isProduction && STAGE !== 'production') {
  issues.push(`Production deployment detected but STAGE is '${STAGE}', should be 'production'`);
} else if (!isProduction && STAGE === 'production') {
  issues.push(`Development deployment detected but STAGE is 'production', should be 'dev'`);
} else {
  console.log('✅ Stage correctly assigned');
}

// Validate Branch/Tag Logic
if (GITHUB_REF.startsWith('refs/tags/v')) {
  console.log('🏷️  Tag-based production deployment detected');
  if (!isProduction) {
    issues.push('Tag deployment should use production stage');
  }
} else if (GITHUB_REF.includes('main') || GITHUB_REF.includes('master')) {
  console.log('🌟 Main branch deployment detected');
} else if (GITHUB_REF.includes('develop')) {
  console.log('🔧 Development branch deployment detected');
} else {
  warnings.push(`Unusual branch detected: ${GITHUB_REF}`);
}

// Check for Required Environment Variables
const requiredVars = ['AWS_REGION', 'STAGE'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  issues.push(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Validate deployment-info.json exists (from previous deployments)
if (fs.existsSync('deployment-info.json')) {
  try {
    const deployInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    console.log('✅ Previous deployment info found');
    
    if (deployInfo.stage && deployInfo.stage !== STAGE) {
      warnings.push(`Previous deployment was for stage '${deployInfo.stage}', current is '${STAGE}'`);
      warnings.push('This might indicate environment confusion or legitimate stage change');
    }
    
    if (deployInfo.region && deployInfo.region !== AWS_REGION) {
      issues.push(`Previous deployment was in region '${deployInfo.region}', current is '${AWS_REGION}'`);
    }
  } catch (error) {
    warnings.push('Could not parse existing deployment-info.json');
  }
} else {
  console.log('ℹ️  No previous deployment info found (first deployment)');
}

// Display Results
console.log('\n📋 Validation Results:');

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  warnings.forEach(warning => console.log(`   - ${warning}`));
}

if (issues.length > 0) {
  console.log('\n❌ Issues Found:');
  issues.forEach(issue => console.log(`   - ${issue}`));
  
  console.log('\n💡 Recommendations:');
  
  if (!GITHUB_ENVIRONMENT) {
    console.log('   1. Set up GitHub Environments (see docs/github-environments-setup.md)');
    console.log('   2. Update workflow to use environment-specific secrets');
  }
  
  if (issues.some(i => i.includes('Region'))) {
    console.log('   3. Ensure all scripts use consistent AWS_REGION defaults');
  }
  
  if (issues.some(i => i.includes('Stage'))) {
    console.log('   4. Check STAGE environment variable assignment logic');
  }
  
  console.log('\n💥 Environment validation failed!');
  process.exit(1);
} else {
  console.log('\n🎉 Environment validation passed!');
  
  if (GITHUB_ENVIRONMENT) {
    console.log(`🚀 Ready for ${expectedEnvironment} deployment with proper environment isolation`);
  } else {
    console.log('🔄 Running in legacy mode - consider upgrading to GitHub Environments');
  }
  
  process.exit(0);
} 