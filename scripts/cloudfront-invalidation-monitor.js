#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

/**
 * CloudFront Invalidation Monitor
 * 
 * Advanced CloudFront invalidation management with monitoring,
 * retry logic, and fallback strategies.
 */

const AWS_REGION = process.env.AWS_REGION || 'il-central-1';

function loadDeploymentInfo() {
  if (fs.existsSync('deployment-info.json')) {
    try {
      return JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    } catch (error) {
      console.warn('⚠️ Could not parse deployment-info.json');
      return null;
    }
  }
  return null;
}

function getActiveInvalidations(distributionId) {
  console.log(`🔍 Checking active invalidations for distribution: ${distributionId}`);
  
  try {
    const result = execSync(
      `aws cloudfront list-invalidations --distribution-id ${distributionId}`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    const data = JSON.parse(result);
    const invalidations = data.InvalidationList.Items || [];
    
    // Filter for recent invalidations (last 24 hours)
    const recent = invalidations.filter(inv => {
      const createTime = new Date(inv.CreateTime);
      const hoursSince = (Date.now() - createTime.getTime()) / (1000 * 60 * 60);
      return hoursSince < 24;
    });
    
    console.log(`📊 Found ${recent.length} recent invalidations (last 24h)`);
    
    recent.forEach(inv => {
      const age = Math.round((Date.now() - new Date(inv.CreateTime).getTime()) / (1000 * 60));
      console.log(`  📋 ${inv.Id}: ${inv.Status} (${age}m ago)`);
    });
    
    return recent;
    
  } catch (error) {
    console.log(`❌ Error listing invalidations: ${error.message}`);
    return [];
  }
}

function monitorInvalidation(distributionId, invalidationId) {
  console.log(`🔄 Monitoring invalidation: ${invalidationId}`);
  
  try {
    const result = execSync(
      `aws cloudfront get-invalidation --distribution-id ${distributionId} --id ${invalidationId}`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    const data = JSON.parse(result);
    const invalidation = data.Invalidation;
    
    const createTime = new Date(invalidation.CreateTime);
    const elapsed = Math.round((Date.now() - createTime.getTime()) / 1000);
    
    console.log(`📊 Invalidation Status Report:`);
    console.log(`   ID: ${invalidation.Id}`);
    console.log(`   Status: ${invalidation.Status}`);
    console.log(`   Created: ${createTime.toISOString()}`);
    console.log(`   Elapsed: ${elapsed}s`);
    console.log(`   Caller Reference: ${invalidation.CallerReference}`);
    
    if (invalidation.InvalidationBatch?.Paths) {
      console.log(`   Paths: ${invalidation.InvalidationBatch.Paths.Items.join(', ')}`);
    }
    
    const statusEmoji = {
      'InProgress': '🔄',
      'Completed': '✅'
    }[invalidation.Status] || '❓';
    
    console.log(`${statusEmoji} Status: ${invalidation.Status}`);
    
    if (invalidation.Status === 'Completed') {
      console.log(`🎉 Invalidation completed successfully!`);
    } else if (invalidation.Status === 'InProgress') {
      const estimatedRemaining = Math.max(0, 300 - elapsed); // CloudFront typically takes ~5 minutes
      console.log(`⏳ Estimated remaining time: ${estimatedRemaining}s`);
    }
    
    return {
      status: invalidation.Status,
      elapsed,
      completed: invalidation.Status === 'Completed'
    };
    
  } catch (error) {
    console.log(`❌ Error monitoring invalidation: ${error.message}`);
    return { error: error.message };
  }
}

function createSmartInvalidation(distributionId, paths = ['/*']) {
  console.log(`🚀 Creating smart CloudFront invalidation...`);
  console.log(`📍 Distribution: ${distributionId}`);
  console.log(`📂 Paths: ${paths.join(', ')}`);
  
  // Check for recent invalidations to avoid conflicts
  const recentInvalidations = getActiveInvalidations(distributionId);
  const inProgressCount = recentInvalidations.filter(inv => inv.Status === 'InProgress').length;
  
  if (inProgressCount > 0) {
    console.log(`⚠️ Warning: ${inProgressCount} invalidations already in progress`);
    console.log(`💡 CloudFront allows up to 3 concurrent invalidations per distribution`);
    
    if (inProgressCount >= 3) {
      console.log(`❌ Cannot create invalidation - maximum concurrent limit reached`);
      console.log(`🔄 Wait for existing invalidations to complete first`);
      return { success: false, error: 'Concurrent limit reached' };
    }
  }
  
  // Create invalidation with unique caller reference
  const callerReference = `equip-track-${Date.now()}`;
  
  try {
    const pathsJson = JSON.stringify(paths);
    const result = execSync(
      `aws cloudfront create-invalidation --distribution-id ${distributionId} --invalidation-batch 'Paths={Items=${pathsJson},Quantity=${paths.length}},CallerReference=${callerReference}'`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    const data = JSON.parse(result);
    const invalidation = data.Invalidation;
    
    console.log(`✅ Invalidation created successfully!`);
    console.log(`📋 Invalidation ID: ${invalidation.Id}`);
    console.log(`🔖 Caller Reference: ${callerReference}`);
    console.log(`⏳ Expected completion: 1-2 minutes`);
    
    return {
      success: true,
      invalidationId: invalidation.Id,
      callerReference,
      paths,
      location: data.Location
    };
    
  } catch (error) {
    console.log(`❌ Invalidation creation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function generateInvalidationReport(distributionId) {
  console.log(`📊 Generating CloudFront Invalidation Report`);
  console.log(`${'═'.repeat(50)}`);
  
  const deploymentInfo = loadDeploymentInfo();
  if (deploymentInfo?.frontend?.cloudfront?.distributionId) {
    console.log(`🔍 Distribution ID: ${deploymentInfo.frontend.cloudfront.distributionId}`);
  } else {
    console.log(`🔍 Distribution ID: ${distributionId || 'Not found in deployment info'}`);
  }
  
  console.log(`🌍 Region: ${AWS_REGION}`);
  console.log(`📅 Report Time: ${new Date().toISOString()}`);
  
  if (!distributionId) {
    console.log(`❌ No distribution ID provided or found`);
    return;
  }
  
  // Get distribution status
  try {
    const distResult = execSync(
      `aws cloudfront get-distribution --id ${distributionId}`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    const distribution = JSON.parse(distResult);
    console.log(`📈 Distribution Status: ${distribution.Distribution.Status}`);
    console.log(`🌐 Domain Name: ${distribution.Distribution.DomainName}`);
    
  } catch (error) {
    console.log(`❌ Error getting distribution info: ${error.message}`);
  }
  
  // Get recent invalidations
  const invalidations = getActiveInvalidations(distributionId);
  
  if (invalidations.length === 0) {
    console.log(`✨ No recent invalidations found`);
  } else {
    console.log(`\n📋 Recent Invalidations:`);
    invalidations.forEach((inv, index) => {
      const age = Math.round((Date.now() - new Date(inv.CreateTime).getTime()) / (1000 * 60));
      const statusEmoji = inv.Status === 'Completed' ? '✅' : '🔄';
      console.log(`  ${index + 1}. ${statusEmoji} ${inv.Id} - ${inv.Status} (${age}m ago)`);
    });
  }
  
  console.log(`\n💡 Tips:`);
  console.log(`  - Use 'node cloudfront-invalidation-monitor.js create <distribution-id>' to create invalidation`);
  console.log(`  - Use 'node cloudfront-invalidation-monitor.js monitor <distribution-id> <invalidation-id>' to track progress`);
  console.log(`  - CloudFront typically completes invalidations within 1-2 minutes`);
  console.log(`  - Maximum 3 concurrent invalidations per distribution`);
}

// Command line interface
const command = process.argv[2];
const distributionId = process.argv[3];
const invalidationId = process.argv[4];

if (command === 'create' && distributionId) {
  createSmartInvalidation(distributionId);
} else if (command === 'monitor' && distributionId && invalidationId) {
  monitorInvalidation(distributionId, invalidationId);
} else if (command === 'list' && distributionId) {
  getActiveInvalidations(distributionId);
} else if (command === 'report') {
  const deploymentInfo = loadDeploymentInfo();
  const distId = distributionId || deploymentInfo?.frontend?.cloudfront?.distributionId;
  generateInvalidationReport(distId);
} else {
  console.log('CloudFront Invalidation Monitor');
  console.log('');
  console.log('Usage:');
  console.log('  node cloudfront-invalidation-monitor.js create <distribution-id>');
  console.log('  node cloudfront-invalidation-monitor.js monitor <distribution-id> <invalidation-id>');
  console.log('  node cloudfront-invalidation-monitor.js list <distribution-id>');
  console.log('  node cloudfront-invalidation-monitor.js report [distribution-id]');
  console.log('');
  console.log('Examples:');
  console.log('  node cloudfront-invalidation-monitor.js create E1234567890ABC');
  console.log('  node cloudfront-invalidation-monitor.js monitor E1234567890ABC I1234567890DEF');
  console.log('  node cloudfront-invalidation-monitor.js report');
}

module.exports = {
  createSmartInvalidation,
  monitorInvalidation,
  getActiveInvalidations,
  generateInvalidationReport
}; 