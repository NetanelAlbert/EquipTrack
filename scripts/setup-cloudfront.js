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
          Quantity: 0
        }
      },
      MinTTL: 0,
      DefaultTTL: 86400,  // 1 day
      MaxTTL: 31536000    // 1 year
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

module.exports = { setupCloudFront }; 