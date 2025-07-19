#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const FRONTEND_DIST_PATH = 'dist/apps/frontend';

// Configurable settings
const FRONTEND_CACHE_MAX_AGE = process.env.FRONTEND_CACHE_MAX_AGE || '31536000';
const FRONTEND_INDEX_CACHE_CONTROL = process.env.FRONTEND_INDEX_CACHE_CONTROL || 'no-cache,no-store,must-revalidate';
const ALLOWED_IPS = process.env.ALLOWED_IPS;

function createS3Bucket() {
  const bucketName = `equip-track-frontend-${STAGE}`;
  
  try {
    // Check if bucket exists
    execSync(`aws s3api head-bucket --bucket ${bucketName}`, { stdio: 'pipe' });
    console.log(`Using existing bucket: ${bucketName}`);
  } catch (error) {
    console.log(`Creating S3 bucket: ${bucketName}`);
    
    try {
      if (AWS_REGION === 'us-east-1') {
        // us-east-1 doesn't need LocationConstraint
        execSync(`aws s3api create-bucket --bucket ${bucketName}`, { stdio: 'inherit' });
      } else {
        execSync(
          `aws s3api create-bucket --bucket ${bucketName} --region ${AWS_REGION} --create-bucket-configuration LocationConstraint=${AWS_REGION}`,
          { stdio: 'inherit' }
        );
      }
    } catch (createError) {
      console.error('Error creating bucket:', createError.message);
      throw createError;
    }
  }
  
  // Configure bucket for static website hosting
  console.log('Configuring bucket for static website hosting...');
  
  // Set public access block to allow public reads
  try {
    execSync(`aws s3api put-public-access-block --bucket ${bucketName} --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"`, { stdio: 'inherit' });
  } catch (error) {
    console.log('Note: Public access block settings may already be configured');
  }
  
  // Configure static website hosting
  const websiteConfig = {
    IndexDocument: { Suffix: 'index.html' },
    ErrorDocument: { Key: 'index.html' } // SPA routing - serve index.html for 404s
  };
  
  fs.writeFileSync('website-config.json', JSON.stringify(websiteConfig));
  execSync(`aws s3api put-bucket-website --bucket ${bucketName} --website-configuration file://website-config.json`, { stdio: 'inherit' });
  fs.unlinkSync('website-config.json');
  
  // Set bucket policy for public read access
  const bucketPolicyStatement = {
    Sid: 'PublicReadGetObject',
    Effect: 'Allow',
    Principal: '*',
    Action: 's3:GetObject',
    Resource: `arn:aws:s3:::${bucketName}/*`
  };
  
  // Add IP restrictions if specified
  if (ALLOWED_IPS) {
    const ipList = ALLOWED_IPS.split(',').map(ip => ip.trim());
    bucketPolicyStatement.Condition = {
      IpAddress: {
        'aws:SourceIp': ipList
      }
    };
    console.log(`🔒 Restricting S3 access to IPs: ${ipList.join(', ')}`);
  }
  
  const bucketPolicy = {
    Version: '2012-10-17',
    Statement: [bucketPolicyStatement]
  };
  
  fs.writeFileSync('bucket-policy.json', JSON.stringify(bucketPolicy));
  execSync(`aws s3api put-bucket-policy --bucket ${bucketName} --policy file://bucket-policy.json`, { stdio: 'inherit' });
  fs.unlinkSync('bucket-policy.json');
  
  console.log(`✅ S3 bucket configured: ${bucketName}`);
  return bucketName;
}

function uploadToS3(bucketName) {
  console.log('Uploading frontend files to S3...');
  
  if (!fs.existsSync(FRONTEND_DIST_PATH)) {
    throw new Error(`Frontend build directory not found: ${FRONTEND_DIST_PATH}`);
  }
  
  // Upload all files with proper content types
  execSync(
    `aws s3 sync ${FRONTEND_DIST_PATH} s3://${bucketName}/ --delete --cache-control max-age=${FRONTEND_CACHE_MAX_AGE}`,
    { stdio: 'inherit' }
  );
  
  // Set specific cache control for index.html (no cache)
  execSync(
    `aws s3 cp s3://${bucketName}/index.html s3://${bucketName}/index.html --metadata-directive REPLACE --cache-control "${FRONTEND_INDEX_CACHE_CONTROL}"`,
    { stdio: 'inherit' }
  );
  
  console.log('✅ Frontend files uploaded to S3');
}

function updateEnvironmentFile() {
  console.log('Updating environment configuration...');
  
  // Load deployment info to get API URL
  if (!fs.existsSync('deployment-info.json')) {
    console.log('⚠️  Warning: deployment-info.json not found. Skipping API URL replacement.');
    return;
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  
  // Try new structure first, fallback to legacy
  const apiUrl = deploymentInfo.backend?.apiGateway?.apiUrl;
  
  if (!apiUrl) {
    console.log('⚠️  Warning: API URL not found in deployment info. Skipping API URL replacement.');
    return;
  }
  const envProdFile = path.join(FRONTEND_DIST_PATH, 'main.js');
  
  if (fs.existsSync(envProdFile)) {
    try {
      let content = fs.readFileSync(envProdFile, 'utf8');
      content = content.replace(/API_URL_PLACEHOLDER/g, apiUrl);
      fs.writeFileSync(envProdFile, content);
      console.log(`✅ Updated API URL to: ${apiUrl}`);
    } catch (error) {
      console.log('⚠️  Warning: Could not update API URL in built files');
    }
  }
}

function deployFrontend() {
  console.log('Deploying frontend to S3...');
  
  // Update environment configuration with actual API URL
  updateEnvironmentFile();
  
  const bucketName = createS3Bucket();
  uploadToS3(bucketName);
  
  const s3WebsiteUrl = `http://${bucketName}.s3-website-${AWS_REGION}.amazonaws.com`;
  
  // Load existing deployment info
  let deploymentInfo = {};
  if (fs.existsSync('deployment-info.json')) {
    deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  }
  
  // Update frontend deployment info
  deploymentInfo.frontend = deploymentInfo.frontend || {};
  deploymentInfo.frontend.s3 = {
    bucketName,
    s3WebsiteUrl,
    region: AWS_REGION,
    stage: STAGE,
    status: 'deployed'
  };
  
  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
  
  console.log('\n🎉 Frontend deployment completed!');
  console.log(`S3 Website URL: ${s3WebsiteUrl}`);
  
  return {
    bucketName,
    s3WebsiteUrl
  };
}

if (require.main === module) {
  deployFrontend();
}

module.exports = { deployFrontend }; 