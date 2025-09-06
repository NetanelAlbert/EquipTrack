#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Update Existing CloudFront Distribution Cache Configuration
 * 
 * This script updates your existing CloudFront distribution with optimized
 * cache behaviors to solve the cache invalidation issues.
 */

const STAGE = process.env.STAGE || 'dev';

function loadDeploymentInfo() {
  if (!fs.existsSync('deployment-info.json')) {
    throw new Error('❌ deployment-info.json not found. Run initial deployment first.');
  }
  return JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
}

function updateCloudFrontCacheConfig() {
  console.log('🔧 Updating CloudFront cache configuration...');
  
  const deploymentInfo = loadDeploymentInfo();
  const distributionId = deploymentInfo.frontend?.cloudfront?.distributionId;
  
  if (!distributionId) {
    throw new Error('❌ CloudFront distribution ID not found in deployment info');
  }
  
  console.log(`📍 Updating distribution: ${distributionId}`);
  
  // Get current distribution config
  console.log('📥 Fetching current distribution configuration...');
  const result = execSync(`aws cloudfront get-distribution-config --id ${distributionId}`, { encoding: 'utf8' });
  const response = JSON.parse(result);
  const config = response.DistributionConfig;
  const etag = response.ETag;
  
  console.log('🔄 Applying optimized cache behaviors...');
  
  // Update default cache behavior
  config.DefaultCacheBehavior.ForwardedValues.Headers = {
    Quantity: 1,
    Items: ['Cache-Control']
  };
  config.DefaultCacheBehavior.MinTTL = 0;
  config.DefaultCacheBehavior.DefaultTTL = 300;  // 5 minutes
  config.DefaultCacheBehavior.MaxTTL = 86400;    // 1 day
  
  // Add specific cache behaviors for different file types
  config.CacheBehaviors = {
    Quantity: 4,
    Items: [
      {
        // HTML files - minimal caching for SPA routing
        PathPattern: '*.html',
        TargetOriginId: config.DefaultCacheBehavior.TargetOriginId,
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
        // JavaScript files - aggressive caching (content-hashed)
        PathPattern: '*.js',
        TargetOriginId: config.DefaultCacheBehavior.TargetOriginId,
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
          // CSS files - aggressive caching (content-hashed)
          PathPattern: '*.css',
          TargetOriginId: config.DefaultCacheBehavior.TargetOriginId,
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
          TargetOriginId: config.DefaultCacheBehavior.TargetOriginId,
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
  };
  
  // Update caller reference for the update
  config.CallerReference = `equip-track-${STAGE}-cache-update-${Date.now()}`;
  
  // Write updated config to file
  const configFile = 'cloudfront-cache-update-config.json';
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  
  console.log('⬆️ Updating CloudFront distribution...');
  console.log('⏳ This may take a few minutes to deploy...');
  
  try {
    execSync(
      `aws cloudfront update-distribution --id ${distributionId} --distribution-config file://${configFile} --if-match ${etag}`,
      { stdio: 'inherit' }
    );
    
    // Clean up config file
    fs.unlinkSync(configFile);
    
    console.log('✅ CloudFront distribution updated successfully!');
    console.log('');
    console.log('🎯 New Cache Configuration:');
    console.log('   📄 HTML files: No cache (immediate updates)');
    console.log('   🎨 CSS files: 1 year cache (content-hashed)');
    console.log('   ⚡ JS files: 1 year cache (content-hashed)');
    console.log('   🌐 Translation files (assets/): 5 minutes cache (for i18n updates)');
    console.log('   📁 Other files: 5 minutes cache');
    console.log('');
    console.log('⏳ Changes will propagate globally within 10-15 minutes');
    console.log('🚀 Future deployments should now work without cache issues!');
    
    return {
      success: true,
      distributionId,
      updated: new Date().toISOString()
    };
    
  } catch (error) {
    // Clean up config file on error
    if (fs.existsSync(configFile)) {
      fs.unlinkSync(configFile);
    }
    throw error;
  }
}

function validateUpdate(distributionId) {
  console.log('🔍 Validating distribution update...');
  
  try {
    const result = execSync(`aws cloudfront get-distribution --id ${distributionId}`, { encoding: 'utf8' });
    const distribution = JSON.parse(result);
    const status = distribution.Distribution.Status;
    
    console.log(`📊 Distribution Status: ${status}`);
    
    if (status === 'InProgress') {
      console.log('⏳ Distribution is updating. Changes will be live when status becomes "Deployed"');
      console.log('📱 You can check status in AWS Console or run this script again');
    } else if (status === 'Deployed') {
      console.log('✅ Distribution is fully deployed with new cache configuration!');
    }
    
    return { status, distributionId };
    
  } catch (error) {
    console.log(`⚠️ Could not validate update: ${error.message}`);
    return { error: error.message };
  }
}

async function main() {
  try {
    console.log('🎯 CloudFront Cache Configuration Update');
    console.log('========================================');
    console.log('');
    console.log('This will optimize your CloudFront cache behaviors to:');
    console.log('• Minimize HTML file caching (immediate updates)');
    console.log('• Maximize static asset caching (JS/CSS with content hashes)');
    console.log('• Respect S3 Cache-Control headers');
    console.log('');
    
    const result = updateCloudFrontCacheConfig();
    
    if (result.success) {
      console.log('');
      validateUpdate(result.distributionId);
      
      console.log('');
      console.log('🎉 Next Steps:');
      console.log('1. Wait 10-15 minutes for changes to propagate');
      console.log('2. Deploy your frontend using the fast deployment script');
      console.log('3. Changes should now be visible immediately to users!');
      console.log('');
      console.log('💡 Test with: node scripts/deploy-frontend-fast.js');
    }
    
  } catch (error) {
    console.error(`\n💥 Update failed: ${error.message}`);
    console.log('\n🔧 Troubleshooting:');
    console.log('• Ensure AWS credentials are configured');
    console.log('• Check that deployment-info.json exists');
    console.log('• Verify CloudFront distribution exists');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateCloudFrontCacheConfig, validateUpdate };
