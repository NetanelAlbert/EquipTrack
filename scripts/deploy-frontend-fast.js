#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const { invalidateCloudFront, loadDeploymentInfo } = require('./setup-cloudfront.js');

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
  
  // Upload hashed static assets with long-term caching and immutable flag
  execSync(
    `aws s3 sync ${FRONTEND_DIST_PATH} s3://${bucketName}/ --delete --exclude "*.html" --exclude "*.xml" --exclude "*.txt" --cache-control "max-age=31536000,immutable"`,
    { stdio: 'inherit' }
  );
  
  // Upload HTML files with strict no-cache headers
  execSync(
    `aws s3 sync ${FRONTEND_DIST_PATH} s3://${bucketName}/ --exclude "*" --include "*.html" --cache-control "no-cache,no-store,must-revalidate"`,
    { stdio: 'inherit' }
  );
  
  // Upload translation files with very short cache (these change frequently)
  execSync(
    `aws s3 sync ${FRONTEND_DIST_PATH} s3://${bucketName}/ --exclude "*" --include "assets/i18n/*" --cache-control "max-age=300"`,
    { stdio: 'inherit' }
  );
  
  // Upload other asset files (images, icons) with medium cache
  execSync(
    `aws s3 sync ${FRONTEND_DIST_PATH} s3://${bucketName}/ --exclude "*" --include "assets/*" --exclude "assets/i18n/*" --cache-control "max-age=3600"`,
    { stdio: 'inherit' }
  );
  
  // Upload other non-hashed files with short cache
  execSync(
    `aws s3 sync ${FRONTEND_DIST_PATH} s3://${bucketName}/ --exclude "*" --include "*.xml" --include "*.txt" --cache-control "max-age=3600"`,
    { stdio: 'inherit' }
  );
  
  const deployTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ S3 deployment completed in ${deployTime}s`);
  
  return deployTime;
}











function updateDeploymentInfo(deploymentInfo, deployTime, invalidationResult, bucketName) {
  const timestamp = new Date().toISOString();
  
  // Ensure deployment info structure exists
  deploymentInfo.frontend = deploymentInfo.frontend || {};
  deploymentInfo.frontend.s3 = deploymentInfo.frontend.s3 || {};
  
  // Update S3 info if we used a fallback bucket name
  if (bucketName && !deploymentInfo.frontend.s3.bucketName) {
    deploymentInfo.frontend.s3.bucketName = bucketName;
    deploymentInfo.frontend.s3.region = AWS_REGION;
    deploymentInfo.frontend.s3.stage = STAGE;
    deploymentInfo.frontend.s3.status = 'deployed';
    deploymentInfo.frontend.s3.s3WebsiteUrl = `http://${bucketName}.s3-website.${AWS_REGION}.amazonaws.com`;
  }
  
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
    
    // Load deployment info with fallback
    let deploymentInfo;
    try {
      deploymentInfo = loadDeploymentInfo();
    } catch (error) {
      console.log('❌ No deployment info found. Fast deployment requires initial full deployment first.');
      console.log('🔧 Solution: Run the full deployment script first:');
      console.log('   node scripts/deploy-frontend.js');
      console.log('   node scripts/setup-cloudfront.js');
      console.log('');
      console.log('📋 This will create the necessary deployment-info.json file.');
      throw new Error('❌ deployment-info.json not found. Run full deployment first.');
    }
    
    // Validate frontend build
    validateBuild();
    
    // Get S3 bucket and CloudFront distribution with fallbacks
    let bucketName = deploymentInfo.frontend?.s3?.bucketName;
    const distributionId = deploymentInfo.frontend?.cloudfront?.distributionId;
    
    // Fallback bucket name based on standard convention
    if (!bucketName) {
      bucketName = `equip-track-frontend-${STAGE}`;
      console.log(`⚠️ S3 bucket not found in deployment info, using fallback: ${bucketName}`);
      console.log('💡 If this fails, run the full deployment first: node scripts/deploy-frontend.js');
    }
    
    if (!distributionId) {
      console.log('⚠️  CloudFront distribution not found - deploying to S3 only');
      console.log('💡 To enable CloudFront, run: node scripts/setup-cloudfront.js');
    }
    
    console.log(`📍 Target bucket: ${bucketName}`);
    console.log(`📍 Distribution: ${distributionId || 'N/A'}`);
    
    // Verify bucket exists before deployment
    try {
      execSync(`aws s3api head-bucket --bucket ${bucketName}`, { stdio: 'pipe' });
      console.log(`✅ S3 bucket verified: ${bucketName}`);
    } catch (error) {
      console.log(`❌ S3 bucket '${bucketName}' does not exist or is not accessible`);
      console.log(`🔧 Solution: Run the full deployment first to create the bucket:`);
      console.log(`   node scripts/deploy-frontend.js`);
      throw new Error(`❌ S3 bucket '${bucketName}' not found. Run full deployment first.`);
    }
    
    // Deploy to S3
    const deployTime = deployToS3(bucketName);
    
    // Invalidate CloudFront cache with enhanced reliability and wait for completion
    let invalidationResult = null;
    if (distributionId) {
      // Set environment variable to wait for invalidation completion
      process.env.WAIT_FOR_INVALIDATION = 'true';
      invalidationResult = invalidateCloudFront(distributionId);
      
      // Handle invalidation failure
      if (!invalidationResult || !invalidationResult.success) {
        console.log('⚠️ CloudFront invalidation failed, but deployment continues');
        if (invalidationResult?.fallbackApplied) {
          console.log('✅ Cache-busting fallback strategy applied');
          console.log('💡 Test your deployment with the cache-busted URL shown above');
        }
        console.log('🔧 Manual invalidation may be required if cache issues persist');
      } else if (invalidationResult.completion?.completed) {
        console.log(`🎉 Cache invalidation completed in ${invalidationResult.completion.duration}s!`);
        console.log('✨ Your changes should now be visible to all users worldwide');
      }
    } else {
      console.log('⚠️ CloudFront distribution not found - skipping cache invalidation');
      console.log('🔍 Check that CloudFront distribution was created successfully');
    }
    
    // Update deployment info
    updateDeploymentInfo(deploymentInfo, deployTime, invalidationResult, bucketName);
    
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