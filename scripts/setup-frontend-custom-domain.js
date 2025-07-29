#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

// Disable AWS CLI pager to prevent interactive prompts
process.env.AWS_PAGER = '';

/**
 * Frontend Custom Domain Setup Script
 * 
 * This script manages CloudFront custom domain configuration:
 * - Creates SSL certificate for frontend domain
 * - Updates CloudFront distribution with custom domain aliases
 * - Creates Route53 A record for domain resolution
 * 
 * Environment variables:
 * - BASE_DOMAIN: Base domain name (default: 'equip-track.com')
 * - FRONTEND_DOMAIN: Frontend domain (overrides stage-based selection)
 * - AWS_REGION: Primary region (default: 'il-central-1')
 * - STAGE: Deployment stage (default: 'dev')
 * 
 * Domains by stage:
 * - Production: equip-track.com
 * - Dev: dev.equip-track.com
 * 
 * Usage:
 * node scripts/setup-frontend-custom-domain.js
 */

const BASE_DOMAIN = process.env.BASE_DOMAIN || 'equip-track.com';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const STAGE = process.env.STAGE || 'dev';

// Stage-aware frontend domain selection
function getFrontendDomain(stage, baseDomain) {
  return stage === 'production' ? baseDomain : `${stage}.${baseDomain}`;
}

const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN || getFrontendDomain(STAGE, BASE_DOMAIN);

console.log(`🌐 Setting up custom domain for frontend: ${FRONTEND_DOMAIN}`);
console.log(`📍 Stage: ${STAGE}`);
console.log(`🏗️  Base domain: ${BASE_DOMAIN}`);

/**
 * Find or create SSL certificate for the frontend domain
 */
function setupSSLCertificate(domain) {
  console.log(`🔒 Setting up SSL certificate for ${domain}...`);
  
  try {
    // Check for existing certificate in us-east-1 (required for CloudFront)
    const listResult = execSync(
      `aws acm list-certificates --region us-east-1 --certificate-statuses ISSUED`,
      { encoding: 'utf8' }
    );
    
    const certificates = JSON.parse(listResult);
    const existingCert = certificates.CertificateSummaryList.find(cert => 
      cert.DomainName === domain || 
      cert.SubjectAlternativeNameSummary?.includes(domain)
    );
    
    if (existingCert) {
      console.log(`✅ Found existing certificate: ${existingCert.CertificateArn}`);
      return existingCert.CertificateArn;
    }
    
    // Request new certificate
    console.log(`📋 Requesting new SSL certificate for ${domain}...`);
    
    const requestResult = execSync(
      `aws acm request-certificate --region us-east-1 --domain-name ${domain} --validation-method DNS --subject-alternative-names "*.${domain}"`,
      { encoding: 'utf8' }
    );
    
    const { CertificateArn } = JSON.parse(requestResult);
    console.log(`🎫 Certificate requested: ${CertificateArn}`);
    
    // Get validation records
    console.log('📝 Getting DNS validation records...');
    let validationRecords = null;
    let retries = 0;
    const maxRetries = 10;
    
    while (!validationRecords && retries < maxRetries) {
      try {
        const certDetails = execSync(
          `aws acm describe-certificate --region us-east-1 --certificate-arn ${CertificateArn}`,
          { encoding: 'utf8' }
        );
        
        const details = JSON.parse(certDetails);
        if (details.Certificate.DomainValidationOptions?.[0]?.ResourceRecord) {
          validationRecords = details.Certificate.DomainValidationOptions;
          break;
        }
        
        console.log(`⏳ Waiting for validation records... (${retries + 1}/${maxRetries})`);
        execSync('sleep 5');
        retries++;
      } catch (error) {
        retries++;
        execSync('sleep 5');
      }
    }
    
    if (!validationRecords) {
      throw new Error('Failed to get DNS validation records');
    }
    
    // Get hosted zone ID
    const hostedZoneResult = execSync(
      `aws route53 list-hosted-zones-by-name --dns-name ${BASE_DOMAIN}`,
      { encoding: 'utf8' }
    );
    
    const hostedZones = JSON.parse(hostedZoneResult);
    const hostedZone = hostedZones.HostedZones.find(zone => zone.Name === `${BASE_DOMAIN}.`);
    
    if (!hostedZone) {
      console.log(`⚠️  No Route53 hosted zone found for ${BASE_DOMAIN}`);
      console.log(`📋 Please create the following DNS records manually:`);
      
      validationRecords.forEach(record => {
        const { ResourceRecord } = record;
        console.log(`   Type: CNAME`);
        console.log(`   Name: ${ResourceRecord.Name}`);
        console.log(`   Value: ${ResourceRecord.Value}`);
        console.log('');
      });
      
      console.log(`⏳ Certificate will be available once DNS validation is complete`);
      return CertificateArn;
    }
    
    // Create DNS validation records
    console.log('📝 Creating DNS validation records...');
    
    const changes = validationRecords.map(record => ({
      Action: 'UPSERT',
      ResourceRecordSet: {
        Name: record.ResourceRecord.Name,
        Type: record.ResourceRecord.Type,
        TTL: 300,
        ResourceRecords: [{ Value: record.ResourceRecord.Value }]
      }
    }));
    
    const changesBatch = {
      Changes: changes
    };
    
    fs.writeFileSync('dns-changes.json', JSON.stringify(changesBatch));
    
    execSync(
      `aws route53 change-resource-record-sets --hosted-zone-id ${hostedZone.Id} --change-batch file://dns-changes.json`,
      { stdio: 'inherit' }
    );
    
    fs.unlinkSync('dns-changes.json');
    
    console.log('✅ DNS validation records created');
    console.log('⏳ Waiting for certificate validation (this may take several minutes)...');
    
    // Wait for certificate validation
    execSync(
      `aws acm wait certificate-validated --region us-east-1 --certificate-arn ${CertificateArn}`,
      { stdio: 'inherit' }
    );
    
    console.log('✅ Certificate validated and issued');
    return CertificateArn;
    
  } catch (error) {
    console.error('❌ SSL certificate setup failed:', error.message);
    throw error;
  }
}

/**
 * Update CloudFront distribution with custom domain
 */
function updateCloudFrontDistribution(distributionId, domain, certificateArn) {
  console.log(`☁️  Updating CloudFront distribution ${distributionId} with custom domain...`);
  
  try {
    // Get current distribution config
    const result = execSync(
      `aws cloudfront get-distribution-config --id ${distributionId}`,
      { encoding: 'utf8' }
    );
    
    const response = JSON.parse(result);
    const config = response.DistributionConfig;
    const etag = response.ETag;
    
    // Add custom domain configuration
    config.Aliases = {
      Quantity: 1,
      Items: [domain]
    };
    
    config.ViewerCertificate = {
      ACMCertificateArn: certificateArn,
      SSLSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.2_2021',
      CertificateSource: 'acm'
    };
    
    // Note: CallerReference cannot be modified during updates, keep the original
    
    // Write updated config
    fs.writeFileSync('cloudfront-update-config.json', JSON.stringify(config));
    
    execSync(
      `aws cloudfront update-distribution --id ${distributionId} --distribution-config file://cloudfront-update-config.json --if-match ${etag}`,
      { stdio: 'inherit' }
    );
    
    fs.unlinkSync('cloudfront-update-config.json');
    
    console.log('✅ CloudFront distribution updated');
    
    // Wait for deployment
    console.log('⏳ Waiting for CloudFront deployment to complete...');
    execSync(
      `aws cloudfront wait distribution-deployed --id ${distributionId}`,
      { stdio: 'inherit' }
    );
    
    console.log('✅ CloudFront deployment completed');
    
  } catch (error) {
    console.error('❌ CloudFront update failed:', error.message);
    throw error;
  }
}

/**
 * Setup Route53 DNS record
 */
function setupDNSRecord(domain, distributionDomainName) {
  console.log(`🌐 Setting up DNS record for ${domain}...`);
  
  try {
    // Get hosted zone
    const hostedZoneResult = execSync(
      `aws route53 list-hosted-zones-by-name --dns-name ${BASE_DOMAIN}`,
      { encoding: 'utf8' }
    );
    
    const hostedZones = JSON.parse(hostedZoneResult);
    const hostedZone = hostedZones.HostedZones.find(zone => zone.Name === `${BASE_DOMAIN}.`);
    
    if (!hostedZone) {
      console.log(`⚠️  No Route53 hosted zone found for ${BASE_DOMAIN}`);
      console.log(`📋 Please create the following DNS record manually:`);
      console.log(`   Type: CNAME`);
      console.log(`   Name: ${domain}`);
      console.log(`   Value: ${distributionDomainName}`);
      return;
    }
    
    // Create A record (alias to CloudFront)
    const changesBatch = {
      Changes: [{
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: domain,
          Type: 'A',
          AliasTarget: {
            DNSName: distributionDomainName,
            EvaluateTargetHealth: false,
            HostedZoneId: 'Z2FDTNDATAQYW2' // CloudFront hosted zone ID
          }
        }
      }]
    };
    
    fs.writeFileSync('dns-changes.json', JSON.stringify(changesBatch));
    
    execSync(
      `aws route53 change-resource-record-sets --hosted-zone-id ${hostedZone.Id} --change-batch file://dns-changes.json`,
      { stdio: 'inherit' }
    );
    
    fs.unlinkSync('dns-changes.json');
    
    console.log('✅ DNS record created');
    
  } catch (error) {
    console.error('❌ DNS setup failed:', error.message);
    throw error;
  }
}

/**
 * Main setup function
 */
async function setupFrontendCustomDomain() {
  try {
    // Load deployment info
    if (!fs.existsSync('deployment-info.json')) {
      throw new Error('deployment-info.json not found. Run deployment first.');
    }
    
    const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    
    if (!deploymentInfo.frontend?.cloudfront?.distributionId) {
      throw new Error('CloudFront distribution not found. Run CloudFront setup first.');
    }
    
    const distributionId = deploymentInfo.frontend.cloudfront.distributionId;
    const distributionDomainName = deploymentInfo.frontend.cloudfront.cloudfrontUrl.replace(/^https?:\/\//, '');
    
    console.log(`📍 Distribution ID: ${distributionId}`);
    console.log(`📍 Distribution domain: ${distributionDomainName}`);
    
    // 1. Setup SSL certificate
    const certificateArn = setupSSLCertificate(FRONTEND_DOMAIN);
    
    // 2. Update CloudFront distribution
    updateCloudFrontDistribution(distributionId, FRONTEND_DOMAIN, certificateArn);
    
    // 3. Setup DNS record
    setupDNSRecord(FRONTEND_DOMAIN, distributionDomainName);
    
    // 4. Update deployment info
    deploymentInfo.customDomains = deploymentInfo.customDomains || {};
    deploymentInfo.customDomains[FRONTEND_DOMAIN] = {
      certificateArn,
      distributionId,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    
    console.log('\n🎉 Frontend custom domain setup completed!');
    console.log(`🌐 Your frontend is now available at: https://${FRONTEND_DOMAIN}`);
    console.log('\n⏳ Note: DNS propagation may take a few minutes to complete worldwide.');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupFrontendCustomDomain();
}

module.exports = { setupFrontendCustomDomain }; 