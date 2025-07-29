#!/usr/bin/env node
const fs = require('fs');

/**
 * Deployment Status Tracker
 * 
 * Tracks deployment progress and provides detailed status reporting
 * for better visibility into deployment success/failure reasons.
 */

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID || 'local';
const GITHUB_SHA = process.env.GITHUB_SHA || 'unknown';

// Track deployment steps
const DEPLOYMENT_STEPS = {
  'prepare': 'Prepare deployment configuration',
  'dynamodb': 'Create DynamoDB tables',
  'lambda-packages': 'Create Lambda deployment packages',
  'lambda-deploy': 'Deploy Lambda functions',
  'api-gateway': 'Deploy API Gateway',
  'frontend-fast': 'Deploy Frontend (Fast)',
  'frontend-full': 'Deploy Frontend (Full setup)',
  'cloudfront': 'Create CloudFront Distribution',
  'custom-domain': 'Setup Custom Domain'
};

function loadDeploymentInfo() {
  if (fs.existsSync('deployment-info.json')) {
    try {
      return JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    } catch (error) {
      console.warn('⚠️ Could not parse existing deployment-info.json');
    }
  }
  return {
    metadata: {
      created: new Date().toISOString(),
      stage: STAGE,
      region: AWS_REGION,
      version: '1.0.0'
    },
    stage: STAGE,
    region: AWS_REGION,
    status: 'initializing'
  };
}

function saveDeploymentInfo(deploymentInfo) {
  deploymentInfo.lastUpdated = new Date().toISOString();
  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
}

function trackStep(stepName, status, details = {}) {
  const deploymentInfo = loadDeploymentInfo();
  
  // Initialize deployment tracking if not exists
  if (!deploymentInfo.deploymentTracking) {
    deploymentInfo.deploymentTracking = {
      runId: GITHUB_RUN_ID,
      commit: GITHUB_SHA,
      started: new Date().toISOString(),
      steps: {}
    };
  }
  
  // Track step status
  deploymentInfo.deploymentTracking.steps[stepName] = {
    name: DEPLOYMENT_STEPS[stepName] || stepName,
    status: status, // 'started', 'success', 'failed', 'skipped'
    timestamp: new Date().toISOString(),
    ...details
  };
  
  // Update overall status
  const steps = deploymentInfo.deploymentTracking.steps;
  const stepStatuses = Object.values(steps).map(step => step.status);
  
  if (stepStatuses.includes('failed')) {
    deploymentInfo.status = 'failed';
  } else if (stepStatuses.includes('started')) {
    deploymentInfo.status = 'in-progress';
  } else if (stepStatuses.every(status => ['success', 'skipped'].includes(status))) {
    deploymentInfo.status = 'completed';
    deploymentInfo.deploymentTracking.completed = new Date().toISOString();
  }
  
  saveDeploymentInfo(deploymentInfo);
  
  // Log status
  const stepDescription = DEPLOYMENT_STEPS[stepName] || stepName;
  const statusEmoji = {
    'started': '🔄',
    'success': '✅',
    'failed': '❌',
    'skipped': '⏭️'
  }[status] || '❓';
  
  console.log(`${statusEmoji} ${stepDescription}: ${status.toUpperCase()}`);
  
  if (details.error) {
    console.log(`   Error: ${details.error}`);
  }
  
  if (details.duration) {
    console.log(`   Duration: ${details.duration}s`);
  }
}

function generateDeploymentReport() {
  const deploymentInfo = loadDeploymentInfo();
  
  if (!deploymentInfo.deploymentTracking) {
    console.log('❓ No deployment tracking information available');
    return;
  }
  
  const tracking = deploymentInfo.deploymentTracking;
  const steps = tracking.steps;
  
  console.log('\n📊 Deployment Status Report');
  console.log('═'.repeat(50));
  console.log(`Stage: ${STAGE}`);
  console.log(`Region: ${AWS_REGION}`);
  console.log(`Run ID: ${tracking.runId}`);
  console.log(`Commit: ${tracking.commit}`);
  console.log(`Started: ${tracking.started}`);
  if (tracking.completed) {
    console.log(`Completed: ${tracking.completed}`);
    const duration = (new Date(tracking.completed) - new Date(tracking.started)) / 1000;
    console.log(`Total Duration: ${duration.toFixed(1)}s`);
  }
  console.log(`Overall Status: ${deploymentInfo.status.toUpperCase()}`);
  
  console.log('\n📋 Step Details:');
  Object.entries(steps).forEach(([stepKey, step]) => {
    const statusEmoji = {
      'started': '🔄',
      'success': '✅',
      'failed': '❌',
      'skipped': '⏭️'
    }[step.status] || '❓';
    
    console.log(`  ${statusEmoji} ${step.name}: ${step.status.toUpperCase()}`);
    if (step.error) {
      console.log(`     Error: ${step.error}`);
    }
    if (step.duration) {
      console.log(`     Duration: ${step.duration}s`);
    }
  });
  
  // Summary
  const stepStatuses = Object.values(steps).map(step => step.status);
  const successCount = stepStatuses.filter(s => s === 'success').length;
  const failedCount = stepStatuses.filter(s => s === 'failed').length;
  const skippedCount = stepStatuses.filter(s => s === 'skipped').length;
  const totalSteps = stepStatuses.length;
  
  console.log('\n📈 Summary:');
  console.log(`  Total Steps: ${totalSteps}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  
  if (deploymentInfo.status === 'completed') {
    console.log('\n🎉 Deployment completed successfully!');
  } else if (deploymentInfo.status === 'failed') {
    console.log('\n💥 Deployment failed!');
    console.log('Check the failed steps above for details.');
  } else {
    console.log('\n🔄 Deployment in progress...');
  }
}

// Command line interface
const command = process.argv[2];
const stepName = process.argv[3];
const status = process.argv[4];

if (command === 'track') {
  if (!stepName || !status) {
    console.error('Usage: node deployment-status-tracker.js track <step-name> <status> [error-message]');
    process.exit(1);
  }
  
  const details = {};
  if (process.argv[5]) {
    details.error = process.argv[5];
  }
  
  trackStep(stepName, status, details);
} else if (command === 'report') {
  generateDeploymentReport();
} else {
  console.log('Deployment Status Tracker');
  console.log('');
  console.log('Usage:');
  console.log('  node deployment-status-tracker.js track <step-name> <status> [error]');
  console.log('  node deployment-status-tracker.js report');
  console.log('');
  console.log('Step names:', Object.keys(DEPLOYMENT_STEPS).join(', '));
  console.log('Statuses: started, success, failed, skipped');
}

module.exports = { trackStep, generateDeploymentReport }; 