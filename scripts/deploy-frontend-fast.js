#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

// Disable AWS CLI pager to prevent interactive prompts
process.env.AWS_PAGER = '';

/**
 * Fast Frontend Deployment Script
 * 
 * Optimized for 30-60 second deployments with zero perceived downtime using:
 * 1. S3 sync for content updates
 * 2. CloudFront cache invalidation for immediate refresh
 * 3. Smart cache headers for optimal performance
 * 
 * This strategy is perfect for 90% of deployments and avoids the 5-15 minute
 * CloudFront distribution update delays.
 */

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const FRONTEND_DIST_PATH = 'dist/apps/frontend/browser';

console.log(`🚀 Starting FAST frontend deployment...`);
console.log(`⚡ Expected deployment time: 30-60 seconds`);
console.log(`🎯 Stage: ${STAGE}`);

function loadDeploymentInfo() {
  if (!fs.existsSync('deployment-info.json')) {
    throw new Error('❌ deployment-info.json not found. Run initial deployment first.');
  }
  return JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
}

function validateBuild() {
  console.log('🔍 Validating frontend build...');
  
  if (!fs.existsSync(FRONTEND_DIST_PATH)) {
    throw new Error(`❌ Frontend build not found: ${FRONTEND_DIST_PATH}`);
  }
  
  const indexPath = `${FRONTEND_DIST_PATH}/index.html`;
  if (!fs.existsSync(indexPath)) {
    throw new Error(`❌ index.html not found: ${indexPath}`);
  }
  
  console.log('✅ Frontend build validated');
}

function deployToS3(bucketName) {
  console.log(`📦 Deploying to S3 bucket: ${bucketName}...`);
  
  const startTime = Date.now();
  
  // Sync all files with optimized cache headers
  execSync(
    `aws s3 sync ${FRONTEND_DIST_PATH} s3://${bucketName}/ --delete --cache-control max-age=31536000 --exclude "*.html"`,
    { stdio: 'inherit' }
  );
  
  // Set no-cache for HTML files (for SPA routing)
  execSync(
    `aws s3 cp ${FRONTEND_DIST_PATH}/index.html s3://${bucketName}/index.html --metadata-directive REPLACE --content-type "text/html" --cache-control "no-cache,no-store,must-revalidate"`,
    { stdio: 'inherit' }
  );
  
  const deployTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ S3 deployment completed in ${deployTime}s`);
  
  return deployTime;
}

function validateDistributionExists(distributionId) {
  console.log(`🔍 Validating CloudFront distribution: ${distributionId}...`);
  
  try {
    const result = execSync(
      `aws cloudfront get-distribution --id ${distributionId}`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    const distribution = JSON.parse(result);
    const status = distribution.Distribution.Status;
    
    console.log(`✅ Distribution found with status: ${status}`);
    
    if (status !== 'Deployed') {
      console.log(`⚠️ Distribution status is '${status}', invalidation may not work properly`);
      return { exists: true, status, warning: `Distribution not fully deployed (${status})` };
    }
    
    return { exists: true, status };
    
  } catch (error) {
    console.log(`❌ Distribution validation failed: ${error.message}`);
    return { exists: false, error: error.message };
  }
}

function createInvalidationWithRetry(distributionId, maxRetries = 3) {
  console.log(`🔄 Creating CloudFront invalidation: ${distributionId}...`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📝 Attempt ${attempt}/${maxRetries}: Creating invalidation...`);
      
      const result = execSync(
        `aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      
      const invalidation = JSON.parse(result);
      console.log(`✅ Invalidation created successfully`);
      console.log(`📋 Invalidation ID: ${invalidation.Invalidation.Id}`);
      
      return {
        success: true,
        invalidationId: invalidation.Invalidation.Id,
        attempt
      };
      
    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`⏳ Waiting ${delay/1000}s before retry...`);
        execSync(`sleep ${delay/1000}`);
      }
    }
  }
  
  return { success: false, attempts: maxRetries };
}

function waitForInvalidationCompletion(distributionId, invalidationId, timeoutMs = 120000) {
  console.log(`⏳ Monitoring invalidation completion: ${invalidationId}...`);
  
  const startTime = Date.now();
  const pollInterval = 10000; // Check every 10 seconds
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = execSync(
        `aws cloudfront get-invalidation --distribution-id ${distributionId} --id ${invalidationId}`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      
      const data = JSON.parse(result);
      const status = data.Invalidation.Status;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`🔄 Invalidation status: ${status} (${elapsed}s elapsed)`);
      
      if (status === 'Completed') {
        console.log(`✅ Invalidation completed successfully in ${elapsed}s`);
        return { completed: true, duration: elapsed };
      }
      
      if (status === 'InProgress') {
        console.log(`⏳ Waiting ${pollInterval/1000}s for completion...`);
        execSync(`sleep ${pollInterval/1000}`);
        continue;
      }
      
      console.log(`⚠️ Unexpected invalidation status: ${status}`);
      return { completed: false, status, duration: elapsed };
      
    } catch (error) {
      console.log(`⚠️ Error checking invalidation status: ${error.message}`);
      break;
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏰ Invalidation monitoring timed out after ${elapsed}s`);
  return { completed: false, timeout: true, duration: elapsed };
}

function addCacheBustingFallback(deploymentInfo) {
  console.log(`🔧 Adding cache-busting fallback strategy...`);
  
  // Add timestamp parameter to URLs for cache busting
  const timestamp = Date.now();
  const cacheBuster = `?v=${timestamp}`;
  
  if (deploymentInfo.frontend?.cloudfront?.cloudfrontUrl) {
    const originalUrl = deploymentInfo.frontend.cloudfront.cloudfrontUrl;
    const cacheBustedUrl = `${originalUrl}${cacheBuster}`;
    
    deploymentInfo.frontend.cloudfront.cacheBustedUrl = cacheBustedUrl;
    deploymentInfo.frontend.cloudfront.cacheBuster = cacheBuster;
    
    console.log(`✅ Cache-busting URL: ${cacheBustedUrl}`);
    console.log(`💡 Use this URL to bypass cache during validation`);
  }
  
  return { timestamp, cacheBuster };
}

function invalidateCloudFront(distributionId) {
  console.log(`🔄 Starting enhanced CloudFront invalidation: ${distributionId}...`);
  
  const startTime = Date.now();
  
  // Step 1: Validate distribution exists
  const validation = validateDistributionExists(distributionId);
  if (!validation.exists) {
    console.log(`❌ Cannot invalidate - distribution does not exist or is inaccessible`);
    return {
      success: false,
      error: 'Distribution validation failed',
      details: validation.error,
      fallbackApplied: false
    };
  }
  
  if (validation.warning) {
    console.log(`⚠️ ${validation.warning}`);
  }
  
  // Step 2: Create invalidation with retry logic
  const invalidationResult = createInvalidationWithRetry(distributionId, 3);
  
  if (!invalidationResult.success) {
    console.log(`❌ All invalidation attempts failed`);
    console.log(`🔧 Applying fallback cache-busting strategy...`);
    
    // Apply fallback strategy
    const deploymentInfo = loadDeploymentInfo();
    const fallback = addCacheBustingFallback(deploymentInfo);
    saveDeploymentInfo(deploymentInfo);
    
    return {
      success: false,
      error: 'Invalidation failed after retries',
      attempts: invalidationResult.attempts,
      fallbackApplied: true,
      fallback
    };
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`✅ CloudFront invalidation initiated successfully`);
  console.log(`📊 Summary:`);
  console.log(`   - Distribution: ${distributionId}`);
  console.log(`   - Invalidation ID: ${invalidationResult.invalidationId}`);
  console.log(`   - Attempts: ${invalidationResult.attempt}`);
  console.log(`   - Setup time: ${totalTime}s`);
  console.log(`⏳ Cache will refresh within 1-2 minutes globally`);
  
  // Optional: Wait for completion (with timeout)
  const waitForCompletion = process.env.WAIT_FOR_INVALIDATION === 'true';
  let completionResult = null;
  
  if (waitForCompletion) {
    console.log(`🔄 Waiting for invalidation completion...`);
    completionResult = waitForInvalidationCompletion(distributionId, invalidationResult.invalidationId);
  }
  
  return {
    success: true,
    invalidationId: invalidationResult.invalidationId,
    invalidationTime: totalTime,
    attempts: invalidationResult.attempt,
    distributionStatus: validation.status,
    completion: completionResult
  };
}

function updateDeploymentInfo(deploymentInfo, deployTime, invalidationResult) {
  const timestamp = new Date().toISOString();
  
  // Update frontend deployment info
  deploymentInfo.frontend.s3.lastDeployment = {
    timestamp,
    deployTime: `${deployTime}s`,
    method: 'fast-deployment',
    invalidation: invalidationResult
  };
  
  // Track deployment history
  if (!deploymentInfo.frontend.deploymentHistory) {
    deploymentInfo.frontend.deploymentHistory = [];
  }
  
  deploymentInfo.frontend.deploymentHistory.unshift({
    timestamp,
    method: 'fast-deployment',
    deployTime: `${deployTime}s`,
    success: true
  });
  
  // Keep only last 10 deployments
  deploymentInfo.frontend.deploymentHistory = deploymentInfo.frontend.deploymentHistory.slice(0, 10);
  
  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
  console.log(`📝 Updated deployment-info.json`);
}

function getCustomDomain(deploymentInfo) {
  // Try to get custom domain from deployment info
  if (deploymentInfo.customDomains) {
    const frontendDomain = Object.keys(deploymentInfo.customDomains).find(domain => !domain.includes('api'));
    if (frontendDomain) return frontendDomain;
  }
  
  // Fallback to CloudFront URL
  return deploymentInfo.frontend?.cloudfront?.cloudfrontUrl || 'your-cloudfront-url';
}

async function deployFrontendFast() {
  try {
    const totalStartTime = Date.now();
    
    // Load deployment info
    const deploymentInfo = loadDeploymentInfo();
    
    // Validate frontend build
    validateBuild();
    
    // Get S3 bucket and CloudFront distribution
    const bucketName = deploymentInfo.frontend?.s3?.bucketName;
    const distributionId = deploymentInfo.frontend?.cloudfront?.distributionId;
    
    if (!bucketName) {
      throw new Error('❌ S3 bucket not found in deployment info');
    }
    
    if (!distributionId) {
      console.log('⚠️  CloudFront distribution not found - deploying to S3 only');
    }
    
    console.log(`📍 Target bucket: ${bucketName}`);
    console.log(`📍 Distribution: ${distributionId || 'N/A'}`);
    
    // Deploy to S3
    const deployTime = deployToS3(bucketName);
    
    // Invalidate CloudFront cache with enhanced reliability
    let invalidationResult = null;
    if (distributionId) {
      invalidationResult = invalidateCloudFront(distributionId);
      
      // Handle invalidation failure
      if (!invalidationResult || !invalidationResult.success) {
        console.log('⚠️ CloudFront invalidation failed, but deployment continues');
        if (invalidationResult?.fallbackApplied) {
          console.log('✅ Cache-busting fallback strategy applied');
          console.log('💡 Test your deployment with the cache-busted URL shown above');
        }
        console.log('🔧 Manual invalidation may be required if cache issues persist');
      }
    } else {
      console.log('⚠️ CloudFront distribution not found - skipping cache invalidation');
      console.log('🔍 Check that CloudFront distribution was created successfully');
    }
    
    // Update deployment info
    updateDeploymentInfo(deploymentInfo, deployTime, invalidationResult);
    
    const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(1);
    const customDomain = getCustomDomain(deploymentInfo);
    
    console.log(`\n🎉 Fast deployment completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total time: ${totalTime}s`);
    console.log(`   - S3 deployment: ${deployTime}s`);
    console.log(`   - Cache invalidation: ${invalidationResult?.success ? invalidationResult.invalidationTime + 's' : 'skipped'}`);
    if (invalidationResult?.success) {
      console.log(`   - Invalidation ID: ${invalidationResult.invalidationId}`);
      console.log(`   - Attempts: ${invalidationResult.attempts}`);
    }
    console.log(`   - Method: Enhanced cache invalidation with validation`);
    
    console.log(`\n🌐 Your frontend is live at:`);
    console.log(`   - Custom domain: https://${customDomain}`);
    if (deploymentInfo.frontend?.cloudfront?.cloudfrontUrl) {
      console.log(`   - CloudFront URL: ${deploymentInfo.frontend.cloudfront.cloudfrontUrl}`);
    }
    
    console.log(`\n⏳ Notes:`);
    console.log(`   - Content is live immediately`);
    console.log(`   - Cache refresh: 1-2 minutes globally`);
    console.log(`   - No downtime during deployment`);
    
    return {
      totalTime,
      deployTime,
      invalidationResult,
      customDomain
    };
    
  } catch (error) {
    console.error(`\n💥 Fast deployment failed: ${error.message}`);
    throw error;
  }
}

if (require.main === module) {
  deployFrontendFast()
    .then((result) => {
      console.log(`\n🎯 Next deployment: Run this script again!`);
      console.log(`   Expected time: 30-60 seconds`);
    })
    .catch(error => {
      console.error(`\n💥 Deployment failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { deployFrontendFast }; 