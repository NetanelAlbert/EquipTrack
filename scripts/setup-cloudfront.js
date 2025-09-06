#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

const STAGE = process.env.STAGE || 'dev';
const CLOUDFRONT_PRICE_CLASS = process.env.CLOUDFRONT_PRICE_CLASS || 'PriceClass_100';
const SKIP_CLOUDFRONT = process.env.SKIP_CLOUDFRONT === 'true';

function createCloudFrontDistribution(bucketName, s3WebsiteUrl) {
  const distributionConfig = {
    CallerReference: `equip-track-${STAGE}-${Date.now()}`,
    Comment: `EquipTrack Frontend Distribution - ${STAGE}`,
    DefaultRootObject: 'index.html',
    Enabled: true,
    PriceClass: CLOUDFRONT_PRICE_CLASS,
    Origins: {
      Quantity: 1,
      Items: [{
        Id: `S3-Website-${bucketName}`,
        DomainName: s3WebsiteUrl.replace(/^https?:\/\//, ''),
        CustomOriginConfig: {
          HTTPPort: 80,
          HTTPSPort: 443,
          OriginProtocolPolicy: 'http-only',
          OriginSslProtocols: {
            Quantity: 3,
            Items: ['TLSv1', 'TLSv1.1', 'TLSv1.2']
          },
          OriginReadTimeout: 30,
          OriginKeepaliveTimeout: 5
        }
      }]
    },
    DefaultCacheBehavior: {
      TargetOriginId: `S3-Website-${bucketName}`,
      ViewerProtocolPolicy: 'redirect-to-https',
      Compress: true,
      TrustedSigners: {
        Enabled: false,
        Quantity: 0
      },
      ForwardedValues: {
        QueryString: false,
        Cookies: {
          Forward: 'none'
        },
        Headers: {
          Quantity: 1,
          Items: ['Cache-Control']
        }
      },
      MinTTL: 0,
      DefaultTTL: 300,    // 5 minutes (much shorter default)
      MaxTTL: 86400       // 1 day max (reduced from 1 year)
    },
    CacheBehaviors: {
      Quantity: 4,
      Items: [
        {
          // HTML files - minimal caching for SPA routing
          PathPattern: '*.html',
          TargetOriginId: `S3-Website-${bucketName}`,
          ViewerProtocolPolicy: 'redirect-to-https',
          Compress: true,
          TrustedSigners: {
            Enabled: false,
            Quantity: 0
          },
          ForwardedValues: {
            QueryString: false,
            Cookies: {
              Forward: 'none'
            },
            Headers: {
              Quantity: 1,
              Items: ['Cache-Control']
            }
          },
          MinTTL: 0,
          DefaultTTL: 0,      // No default caching for HTML
          MaxTTL: 300         // 5 minutes max
        },
        {
          // Static assets with content hashes - aggressive caching
          PathPattern: '*.js',
          TargetOriginId: `S3-Website-${bucketName}`,
          ViewerProtocolPolicy: 'redirect-to-https',
          Compress: true,
          TrustedSigners: {
            Enabled: false,
            Quantity: 0
          },
          ForwardedValues: {
            QueryString: false,
            Cookies: {
              Forward: 'none'
            },
            Headers: {
              Quantity: 0
            }
          },
          MinTTL: 0,
          DefaultTTL: 31536000,  // 1 year for JS files with content hashes
          MaxTTL: 31536000       // 1 year max
        },
        {
          // CSS files - aggressive caching
          PathPattern: '*.css',
          TargetOriginId: `S3-Website-${bucketName}`,
          ViewerProtocolPolicy: 'redirect-to-https',
          Compress: true,
          TrustedSigners: {
            Enabled: false,
            Quantity: 0
          },
          ForwardedValues: {
            QueryString: false,
            Cookies: {
              Forward: 'none'
            },
            Headers: {
              Quantity: 0
            }
          },
          MinTTL: 0,
          DefaultTTL: 31536000,  // 1 year for CSS files with content hashes
          MaxTTL: 31536000       // 1 year max
        },
        {
          // Translation and asset files (i18n, images, icons) - short caching
          PathPattern: 'assets/*',
          TargetOriginId: `S3-Website-${bucketName}`,
          ViewerProtocolPolicy: 'redirect-to-https',
          Compress: true,
          TrustedSigners: {
            Enabled: false,
            Quantity: 0
          },
          ForwardedValues: {
            QueryString: false,
            Cookies: {
              Forward: 'none'
            },
            Headers: {
              Quantity: 1,
              Items: ['Cache-Control']
            }
          },
          MinTTL: 0,
          DefaultTTL: 300,       // 5 minutes for asset files including translations
          MaxTTL: 3600           // 1 hour max for assets
        }
      ]
    },
    CustomErrorResponses: {
      Quantity: 2,
      Items: [{
        ErrorCode: 404,
        ResponsePagePath: '/index.html',
        ResponseCode: '200',
        ErrorCachingMinTTL: 0
      }, {
        ErrorCode: 403,
        ResponsePagePath: '/index.html',
        ResponseCode: '200',
        ErrorCachingMinTTL: 0
      }]
    }
  };

  // Write distribution config to file
  fs.writeFileSync('cloudfront-config.json', JSON.stringify(distributionConfig));

  console.log('Creating CloudFront distribution...');
  console.log('This may take several minutes...');

  try {
    const result = execSync(
      'aws cloudfront create-distribution --distribution-config file://cloudfront-config.json',
      { encoding: 'utf8' }
    );

    const distribution = JSON.parse(result);
    const distributionId = distribution.Distribution.Id;
    const cloudfrontUrl = `https://${distribution.Distribution.DomainName}`;

    console.log(`✅ CloudFront distribution created: ${distributionId}`);
    console.log(`🌐 CloudFront URL: ${cloudfrontUrl}`);
    console.log('⏳ Distribution is deploying... This can take 10-15 minutes to be fully available.');

    // Clean up temp file
    fs.unlinkSync('cloudfront-config.json');

    return {
      distributionId,
      cloudfrontUrl,
      status: 'InProgress'
    };

  } catch (error) {
    // Clean up temp file
    if (fs.existsSync('cloudfront-config.json')) {
      fs.unlinkSync('cloudfront-config.json');
    }
    throw error;
  }
}

function findExistingDistribution(bucketName) {
  try {
    const result = execSync('aws cloudfront list-distributions', { encoding: 'utf8' });
    const distributions = JSON.parse(result);
    
    if (!distributions.DistributionList || !distributions.DistributionList.Items) {
      return null;
    }

    // Look for distribution with matching origin
    const existing = distributions.DistributionList.Items.find(dist => {
      return dist.Origins.Items.some(origin => 
        origin.DomainName.includes(bucketName)
      );
    });

    if (existing) {
      return {
        distributionId: existing.Id,
        cloudfrontUrl: `https://${existing.DomainName}`,
        status: existing.Status
      };
    }

    return null;
  } catch (error) {
    console.log('Error checking for existing distributions:', error.message);
    return null;
  }
}

function updateDistributionIfNeeded(distributionId, bucketName, s3WebsiteUrl) {
  console.log(`Checking if distribution ${distributionId} needs updates...`);
  
  try {
    // Get current distribution config
    const result = execSync(`aws cloudfront get-distribution-config --id ${distributionId}`, { encoding: 'utf8' });
    const response = JSON.parse(result);
    const config = response.DistributionConfig;
    const etag = response.ETag;

    // Check if origin domain matches current S3 website URL
    const currentOrigin = config.Origins.Items[0];
    const expectedDomain = s3WebsiteUrl.replace(/^https?:\/\//, '');

    if (currentOrigin.DomainName !== expectedDomain) {
      console.log('Updating CloudFront distribution with new origin...');
      
      // Update the origin domain and ID
      config.Origins.Items[0].DomainName = expectedDomain;
      config.Origins.Items[0].Id = `S3-Website-${bucketName}`;
      config.DefaultCacheBehavior.TargetOriginId = `S3-Website-${bucketName}`;
      config.CallerReference = `equip-track-${STAGE}-update-${Date.now()}`;

      // Ensure proper CustomOriginConfig settings
      config.Origins.Items[0].CustomOriginConfig = {
        HTTPPort: 80,
        HTTPSPort: 443,
        OriginProtocolPolicy: 'http-only',
        OriginSslProtocols: {
          Quantity: 3,
          Items: ['TLSv1', 'TLSv1.1', 'TLSv1.2']
        },
        OriginReadTimeout: 30,
        OriginKeepaliveTimeout: 5
      };

      // Write updated config
      fs.writeFileSync('cloudfront-update-config.json', JSON.stringify(config));

      execSync(
        `aws cloudfront update-distribution --id ${distributionId} --distribution-config file://cloudfront-update-config.json --if-match ${etag}`,
        { stdio: 'inherit' }
      );

      fs.unlinkSync('cloudfront-update-config.json');
      console.log('✅ Distribution updated');
    } else {
      console.log('✅ Distribution is up to date');
    }

  } catch (error) {
    console.log('Note: Could not update distribution, but continuing with existing one');
    if (fs.existsSync('cloudfront-update-config.json')) {
      fs.unlinkSync('cloudfront-update-config.json');
    }
  }
}

// Helper functions for invalidation
function loadDeploymentInfo() {
  if (!fs.existsSync('deployment-info.json')) {
    throw new Error('❌ deployment-info.json not found. Run initial deployment first.');
  }
  return JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
}

function saveDeploymentInfo(deploymentInfo) {
  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
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
        `aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*" "/assets/i18n/*"`,
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

function setupCloudFront() {
  console.log('Setting up CloudFront distribution...');

  // Check if CloudFront should be skipped
  if (SKIP_CLOUDFRONT) {
    console.log('⏩ Skipping CloudFront setup (SKIP_CLOUDFRONT=true)');
    return { skipped: true };
  }

  // Load deployment info to get S3 details
  if (!fs.existsSync('deployment-info.json')) {
    throw new Error('deployment-info.json not found. Run deploy-frontend.js first.');
  }

  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  
  if (!deploymentInfo.frontend || !deploymentInfo.frontend.s3) {
    throw new Error('Frontend S3 deployment info not found. Run deploy-frontend.js first.');
  }

  const { bucketName, s3WebsiteUrl } = deploymentInfo.frontend.s3;

  // Check for existing distribution
  const existing = findExistingDistribution(bucketName);
  
  let cloudfront;
  if (existing) {
    console.log(`Using existing CloudFront distribution: ${existing.distributionId}`);
    updateDistributionIfNeeded(existing.distributionId, bucketName, s3WebsiteUrl);
    cloudfront = existing;
  } else {
    cloudfront = createCloudFrontDistribution(bucketName, s3WebsiteUrl);
  }

  // Update deployment info with CloudFront details
  deploymentInfo.frontend = deploymentInfo.frontend || {};
  deploymentInfo.frontend.cloudfront = {
    distributionId: cloudfront.distributionId,
    cloudfrontUrl: cloudfront.cloudfrontUrl,
    status: cloudfront.status
  };
  deploymentInfo.frontend.cloudfrontUrl = cloudfront.cloudfrontUrl;

  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));

  console.log('\n🎉 CloudFront setup completed!');
  console.log(`CloudFront URL: ${cloudfront.cloudfrontUrl}`);
  
  if (cloudfront.status === 'InProgress') {
    console.log('\n⏳ Note: Distribution is still deploying and may take 10-15 minutes to be fully available worldwide.');
    console.log('   You can check the status in the AWS CloudFront console.');
  }

  return cloudfront;
}

if (require.main === module) {
  setupCloudFront();
}

module.exports = { 
  setupCloudFront, 
  invalidateCloudFront,
  loadDeploymentInfo,
  saveDeploymentInfo
}; 