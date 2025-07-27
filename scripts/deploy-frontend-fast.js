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

function invalidateCloudFront(distributionId) {
  console.log(`🔄 Invalidating CloudFront cache: ${distributionId}...`);
  
  const startTime = Date.now();
  
  try {
    const result = execSync(
      `aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*"`,
      { encoding: 'utf8' }
    );
    
    const invalidation = JSON.parse(result);
    const invalidationTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`✅ Cache invalidation created in ${invalidationTime}s`);
    console.log(`📋 Invalidation ID: ${invalidation.Invalidation.Id}`);
    console.log(`⏳ Propagation time: 1-2 minutes`);
    
    return {
      invalidationId: invalidation.Invalidation.Id,
      invalidationTime
    };
    
  } catch (error) {
    console.log(`⚠️  Cache invalidation failed: ${error.message}`);
    console.log(`ℹ️  Your deployment is still live, but cache may take longer to update`);
    return null;
  }
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
    
    // Invalidate CloudFront cache
    let invalidationResult = null;
    if (distributionId) {
      invalidationResult = invalidateCloudFront(distributionId);
    }
    
    // Update deployment info
    updateDeploymentInfo(deploymentInfo, deployTime, invalidationResult);
    
    const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(1);
    const customDomain = getCustomDomain(deploymentInfo);
    
    console.log(`\n🎉 Fast deployment completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total time: ${totalTime}s`);
    console.log(`   - S3 deployment: ${deployTime}s`);
    console.log(`   - Cache invalidation: ${invalidationResult ? invalidationResult.invalidationTime + 's' : 'skipped'}`);
    console.log(`   - Method: Smart cache invalidation`);
    
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