#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

// Disable AWS CLI pager to prevent interactive prompts
process.env.AWS_PAGER = '';

/**
 * API Gateway Custom Domain Setup Script
 * 
 * This script manages API Gateway custom domain configuration:
 * - Creates custom domain name with SSL certificate
 * - Sets up base path mapping to API Gateway
 * - Creates Route53 A record for domain resolution
 * - Handles RECREATE_API scenarios by preserving domain mappings
 * 
 * Environment variables:
 * - BASE_DOMAIN: Base domain name (default: 'equip-track.com')
 * - API_DOMAIN: API subdomain (overrides stage-based selection)
 * - AWS_REGION: Primary region (default: 'il-central-1')
 * - STAGE: Deployment stage (default: 'dev')
 * 
 * Domains by stage:
 * - Production: api.equip-track.com
 * - Dev: dev-api.equip-track.com
 * 
 * Usage:
 * node scripts/setup-api-custom-domain.js
 * node scripts/setup-api-custom-domain.js --api-id <api-gateway-id>
 */

const BASE_DOMAIN = process.env.BASE_DOMAIN || 'equip-track.com';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const STAGE = process.env.STAGE || 'dev';

// Stage-aware API domain selection
function getAPIDomain(stage, baseDomain) {
  return stage === 'production' ? `api.${baseDomain}` : `${stage}-api.${baseDomain}`;
}

const API_DOMAIN = process.env.API_DOMAIN || getAPIDomain(STAGE, BASE_DOMAIN);

console.log(`🎯 Setting up API Gateway custom domain: ${API_DOMAIN}`);
console.log(`🌍 Primary region: ${AWS_REGION}`);
console.log(`🏷️  Stage: ${STAGE}\n`);

function getDeploymentInfo() {
  if (!fs.existsSync('deployment-info.json')) {
    throw new Error('❌ deployment-info.json not found. Run deployment scripts first.');
  }
  
  try {
    return JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  } catch (error) {
    throw new Error(`❌ Failed to read deployment-info.json: ${error.message}`);
  }
}

function getCertificateArn(domainName, region) {
  console.log(`🔍 Looking up certificate for ${domainName} in ${region}...`);
  
  const deploymentInfo = getDeploymentInfo();
  const certificates = deploymentInfo.certificates;
  
  if (certificates && certificates[BASE_DOMAIN] && certificates[BASE_DOMAIN].regions[region]) {
    const certArn = certificates[BASE_DOMAIN].regions[region].arn;
    console.log(`✅ Found certificate: ${certArn}`);
    return certArn;
  }
  
  // Fallback: search for certificate via AWS CLI
  try {
    console.log(`🔍 Searching for certificate via AWS CLI...`);
    const result = execSync(
      `aws acm list-certificates --region ${region} --query "CertificateSummaryList[?DomainName=='${domainName}' && Status=='ISSUED'].CertificateArn" --output text`,
      { encoding: 'utf8' }
    );
    
    const certArn = result.trim();
    if (certArn && certArn !== 'None') {
      console.log(`✅ Found certificate via CLI: ${certArn}`);
      return certArn;
    }
    
    throw new Error(`❌ No valid certificate found for ${domainName} in ${region}`);
  } catch (error) {
    throw new Error(`❌ Failed to find certificate: ${error.message}`);
  }
}

function getHostedZoneId(domainName) {
  console.log(`🔍 Looking up hosted zone for ${domainName}...`);
  
  try {
    const result = execSync(
      `aws route53 list-hosted-zones --query "HostedZones[?Name=='${domainName}.'].Id" --output text`,
      { encoding: 'utf8' }
    );
    
    const hostedZoneId = result.trim().replace('/hostedzone/', '');
    
    if (!hostedZoneId || hostedZoneId === 'None') {
      throw new Error(`❌ No hosted zone found for domain: ${domainName}`);
    }
    
    console.log(`✅ Found hosted zone: ${hostedZoneId}`);
    return hostedZoneId;
  } catch (error) {
    throw new Error(`❌ Failed to get hosted zone for ${domainName}: ${error.message}`);
  }
}

function checkExistingCustomDomain(apiDomain) {
  console.log(`🔍 Checking for existing custom domain: ${apiDomain}...`);
  
  try {
    const result = execSync(
      `aws apigateway get-domain-name --domain-name ${apiDomain}`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    const domainInfo = JSON.parse(result);
    console.log(`✅ Custom domain already exists: ${apiDomain}`);
    return domainInfo;
  } catch (error) {
    if (error.stderr && error.stderr.includes('NotFoundException')) {
      console.log(`ℹ️  Custom domain does not exist: ${apiDomain}`);
      return null;
    }
    throw new Error(`❌ Error checking custom domain: ${error.message}`);
  }
}

function createCustomDomain(apiDomain, certificateArn) {
  console.log(`📝 Creating custom domain: ${apiDomain}...`);
  
  try {
    // First check if there are any existing domains that might conflict
    console.log(`🔍 Checking for potential conflicts...`);
    
    // Try creating with REGIONAL endpoint type (which requires certificate in same region)
    const result = execSync(
      `aws apigateway create-domain-name --domain-name ${apiDomain} --regional-certificate-arn ${certificateArn} --endpoint-configuration types=REGIONAL --security-policy TLS_1_2`,
      { encoding: 'utf8' }
    );
    
    const domainInfo = JSON.parse(result);
    console.log(`✅ Created custom domain: ${apiDomain}`);
    console.log(`   Regional domain name: ${domainInfo.regionalDomainName}`);
    console.log(`   Regional hosted zone ID: ${domainInfo.regionalHostedZoneId}`);
    
    return domainInfo;
  } catch (error) {
    // If REGIONAL fails, it might be due to existing configuration or conflict
    if (error.message.includes('Cannot import certificates for EDGE while REGIONAL is active')) {
      console.log(`⚠️  Certificate conflict detected. Trying to resolve...`);
      
      // Check if domain already exists with different configuration
      try {
        const checkResult = execSync(
          `aws apigateway get-domain-name --domain-name ${apiDomain}`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        
        const existingDomain = JSON.parse(checkResult);
        console.log(`ℹ️  Found existing domain with different configuration`);
        console.log(`   Existing endpoint type: ${existingDomain.endpointConfiguration ? existingDomain.endpointConfiguration.types : 'Unknown'}`);
        
        // Delete existing domain and recreate
        console.log(`🗑️  Deleting existing domain to recreate with correct configuration...`);
        execSync(`aws apigateway delete-domain-name --domain-name ${apiDomain}`, { stdio: 'inherit' });
        
        // Wait a moment for deletion to propagate
        console.log(`⏳ Waiting for deletion to complete...`);
        execSync('sleep 5', { stdio: 'inherit' });
        
        // Retry creation
        const retryResult = execSync(
          `aws apigateway create-domain-name --domain-name ${apiDomain} --regional-certificate-arn ${certificateArn} --endpoint-configuration types=REGIONAL --security-policy TLS_1_2`,
          { encoding: 'utf8' }
        );
        
        const retryDomainInfo = JSON.parse(retryResult);
        console.log(`✅ Created custom domain after cleanup: ${apiDomain}`);
        return retryDomainInfo;
        
      } catch (retryError) {
        throw new Error(`❌ Failed to resolve domain conflict: ${retryError.message}`);
      }
    }
    
    throw new Error(`❌ Failed to create custom domain: ${error.message}`);
  }
}

function getExistingBasePath(apiDomain) {
  console.log(`🔍 Checking existing base path mappings for ${apiDomain}...`);
  
  try {
    const result = execSync(
      `aws apigateway get-base-path-mappings --domain-name ${apiDomain}`,
      { encoding: 'utf8' }
    );
    
    // Handle empty response or no mappings
    if (!result || result.trim() === '') {
      console.log(`ℹ️  No existing base path mappings found (empty response)`);
      return [];
    }
    
    const mappings = JSON.parse(result);
    const items = mappings.items || [];
    console.log(`✅ Found ${items.length} existing base path mappings`);
    
    if (items.length > 0) {
      items.forEach(mapping => {
        console.log(`   Base path: "${mapping.basePath || '(none)'}" -> API: ${mapping.restApiId}, Stage: ${mapping.stage}`);
      });
    }
    
    return items;
  } catch (error) {
    if (error.stderr && error.stderr.includes('NotFoundException')) {
      console.log(`ℹ️  No existing base path mappings found`);
      return [];
    }
    if (error.message.includes('Unexpected end of JSON input')) {
      console.log(`ℹ️  No existing base path mappings found (empty JSON)`);
      return [];
    }
    throw new Error(`❌ Error checking base path mappings: ${error.message}`);
  }
}

function deleteBasePath(apiDomain, basePath = '') {
  console.log(`🗑️  Deleting base path mapping: "${basePath || '(root)'}"`);
  
  try {
    // For empty/root base path, don't include --base-path parameter at all
    if (basePath && basePath.trim()) {
      execSync(
        `aws apigateway delete-base-path-mapping --domain-name ${apiDomain} --base-path "${basePath}"`,
        { stdio: 'inherit' }
      );
    } else {
      // Root path mapping - no base path parameter needed
      execSync(
        `aws apigateway delete-base-path-mapping --domain-name ${apiDomain}`,
        { stdio: 'inherit' }
      );
    }
    console.log(`✅ Deleted base path mapping: "${basePath || '(root)'}"`);
  } catch (error) {
    console.log(`⚠️  Could not delete base path mapping: ${error.message}`);
  }
}

function createBasePath(apiDomain, apiId, stage, basePath = '') {
  console.log(`📝 Creating base path mapping: "${basePath || '(root)'}" -> ${apiId}/${stage}`);
  
  try {
    const basePathArg = basePath ? `--base-path ${basePath}` : '';
    const result = execSync(
      `aws apigateway create-base-path-mapping --domain-name ${apiDomain} --rest-api-id ${apiId} --stage ${stage} ${basePathArg}`,
      { encoding: 'utf8' }
    );
    
    console.log(`✅ Created base path mapping successfully`);
    return JSON.parse(result);
  } catch (error) {
    throw new Error(`❌ Failed to create base path mapping: ${error.message}`);
  }
}

function createRoute53Record(apiDomain, regionalDomainName, regionalHostedZoneId, hostedZoneId) {
  console.log(`📝 Creating Route53 A record for ${apiDomain}...`);
  
  try {
    // Check if record already exists
    const existingResult = execSync(
      `aws route53 list-resource-record-sets --hosted-zone-id ${hostedZoneId} --query "ResourceRecordSets[?Name=='${apiDomain}.']"`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    const existingRecords = JSON.parse(existingResult);
    if (existingRecords.length > 0) {
      console.log(`ℹ️  A record already exists for ${apiDomain}, updating...`);
    }
    
    const changeRequest = {
      Changes: [{
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: apiDomain,
          Type: 'A',
          AliasTarget: {
            DNSName: regionalDomainName,
            EvaluateTargetHealth: false,
            HostedZoneId: regionalHostedZoneId
          }
        }
      }]
    };
    
    // Write change request to temporary file
    fs.writeFileSync('route53-api-change.json', JSON.stringify(changeRequest, null, 2));
    
    const result = execSync(
      `aws route53 change-resource-record-sets --hosted-zone-id ${hostedZoneId} --change-batch file://route53-api-change.json`,
      { encoding: 'utf8' }
    );
    
    const changeInfo = JSON.parse(result);
    console.log(`✅ Route53 A record created/updated: ${changeInfo.ChangeInfo.Id}`);
    
    // Clean up temp file
    fs.unlinkSync('route53-api-change.json');
    
    return changeInfo;
  } catch (error) {
    throw new Error(`❌ Failed to create Route53 record: ${error.message}`);
  }
}

function getCurrentApiId() {
  const deploymentInfo = getDeploymentInfo();
  
  // Check both possible locations for API ID
  const apiId = deploymentInfo.backend?.apiGateway?.apiId || 
                deploymentInfo.api?.apiId;
  
  if (!apiId) {
    throw new Error('❌ No API Gateway ID found in deployment-info.json');
  }
  
  console.log(`✅ Using API Gateway ID: ${apiId}`);
  return apiId;
}

function updateDeploymentInfo(domainInfo) {
  console.log(`📝 Updating deployment-info.json with custom domain details...`);
  
  const deploymentInfo = getDeploymentInfo();
  
  // Initialize customDomains section if it doesn't exist
  deploymentInfo.customDomains = deploymentInfo.customDomains || {};
  deploymentInfo.customDomains[API_DOMAIN] = {
    domainName: API_DOMAIN,
    regionalDomainName: domainInfo.regionalDomainName,
    regionalHostedZoneId: domainInfo.regionalHostedZoneId,
    certificateArn: domainInfo.certificateArn,
    status: 'active',
    apiId: domainInfo.currentApiId,
    stage: STAGE,
    createdAt: new Date().toISOString()
  };
  
  // Update API Gateway section
  if (deploymentInfo.backend && deploymentInfo.backend.apiGateway) {
    deploymentInfo.backend.apiGateway.customDomain = API_DOMAIN;
    deploymentInfo.backend.apiGateway.customApiUrl = `https://${API_DOMAIN}`;
  }
  
  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Updated deployment-info.json with custom domain details`);
}

async function setupAPICustomDomain(apiId = null) {
  try {
    console.log(`🚀 Starting API Gateway custom domain setup...\n`);
    
    // Get required information
    const certificateArn = getCertificateArn(BASE_DOMAIN, AWS_REGION);
    const hostedZoneId = getHostedZoneId(BASE_DOMAIN);
    const currentApiId = apiId || getCurrentApiId();
    
    // Check if custom domain already exists
    let domainInfo = checkExistingCustomDomain(API_DOMAIN);
    
    if (!domainInfo) {
      // Create custom domain
      domainInfo = createCustomDomain(API_DOMAIN, certificateArn);
    }
    
    // Check existing base path mappings
    const existingMappings = getExistingBasePath(API_DOMAIN);
    
    // Clean up old mappings if they exist
    for (const mapping of existingMappings) {
      if (mapping.restApiId !== currentApiId) {
        console.log(`🔄 Removing outdated mapping for API ${mapping.restApiId}`);
        deleteBasePath(API_DOMAIN, mapping.basePath || '');
      }
    }
    
    // Create new base path mapping for current API
    const needsNewMapping = !existingMappings.find(m => 
      m.restApiId === currentApiId && m.stage === STAGE && !m.basePath
    );
    
    if (needsNewMapping) {
      createBasePath(API_DOMAIN, currentApiId, STAGE);
    } else {
      console.log(`✅ Base path mapping already exists for current API`);
    }
    
    // Create/update Route53 record
    createRoute53Record(
      API_DOMAIN, 
      domainInfo.regionalDomainName, 
      domainInfo.regionalHostedZoneId, 
      hostedZoneId
    );
    
    // Update deployment info
    domainInfo.currentApiId = currentApiId;
    updateDeploymentInfo(domainInfo);
    
    console.log(`\n🎉 API Gateway custom domain setup completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Custom domain: ${API_DOMAIN}`);
    console.log(`   - API Gateway ID: ${currentApiId}`);
    console.log(`   - Regional domain: ${domainInfo.regionalDomainName}`);
    console.log(`   - Certificate: ${certificateArn}`);
    console.log(`   - DNS propagation: 5-60 minutes`);
    console.log(`\n✅ API will be available at: https://${API_DOMAIN}`);
    
    return {
      customDomain: API_DOMAIN,
      regionalDomainName: domainInfo.regionalDomainName,
      apiId: currentApiId,
      certificateArn
    };
    
  } catch (error) {
    console.error(`\n💥 API Gateway custom domain setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Command line argument parsing
function parseArguments() {
  const args = process.argv.slice(2);
  let apiId = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-id' && i + 1 < args.length) {
      apiId = args[i + 1];
      console.log(`🎯 Using provided API ID: ${apiId}`);
    }
  }
  
  return { apiId };
}

if (require.main === module) {
  const { apiId } = parseArguments();
  setupAPICustomDomain(apiId);
}

module.exports = { setupAPICustomDomain }; 