#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

// Disable AWS CLI pager to prevent interactive prompts
process.env.AWS_PAGER = '';

/**
 * AWS Resource Cleanup Script
 * 
 * This script identifies and optionally removes duplicate or orphaned AWS resources:
 * - Multiple API Gateways with similar names
 * - Route 53 records pointing to non-existent resources
 * - Orphaned custom domains without base path mappings
 * 
 * Environment variables:
 * - STAGE: Deployment stage (default: 'dev')
 * - AWS_REGION: AWS region (default: 'il-central-1')
 * - DRY_RUN: Set to 'false' to actually delete resources (default: 'true')
 * - BASE_DOMAIN: Base domain name (default: 'equip-track.com')
 * 
 * Usage:
 * node scripts/cleanup-duplicate-resources.js                 # Dry run (list only)
 * DRY_RUN=false node scripts/cleanup-duplicate-resources.js   # Actually delete
 */

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'equip-track.com';

console.log(`🧹 AWS Resource Cleanup Tool`);
console.log(`🏷️  Stage: ${STAGE}`);
console.log(`🌍 Region: ${AWS_REGION}`);
console.log(`🔍 Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will delete resources)'}`);
console.log(`📋 Base domain: ${BASE_DOMAIN}\n`);

if (DRY_RUN) {
  console.log(`⚠️  DRY RUN MODE: This will only list resources without deleting them`);
  console.log(`🔥 To actually delete resources, run: DRY_RUN=false node scripts/cleanup-duplicate-resources.js\n`);
}

async function findDuplicateAPIGateways() {
  console.log(`🔍 Checking for duplicate API Gateways...`);
  
  try {
    const result = execSync(`aws apigateway get-rest-apis --no-paginate`, { encoding: 'utf8' });
    const apis = JSON.parse(result).items;
    
    // Group APIs by stage
    const apisByStage = {};
    const duplicates = [];
    
    apis.forEach(api => {
      // Match our naming pattern
      const match = api.name.match(/^equip-track-api-(.+?)(?:-recreated-.*)?$/);
      if (match) {
        const stage = match[1];
        if (!apisByStage[stage]) {
          apisByStage[stage] = [];
        }
        apisByStage[stage].push(api);
      }
    });
    
    // Find stages with multiple APIs
    Object.keys(apisByStage).forEach(stage => {
      const stageAPIs = apisByStage[stage];
      if (stageAPIs.length > 1) {
        console.log(`⚠️  Found ${stageAPIs.length} APIs for stage '${stage}':`);
        stageAPIs.forEach((api, index) => {
          const isOld = api.name.includes('-recreated-');
          console.log(`   ${index + 1}. ${api.name} (${api.id}) ${isOld ? '← OLD' : '← CURRENT?'}`);
        });
        
        // Mark old APIs for deletion (those with -recreated- in the name)
        const oldAPIs = stageAPIs.filter(api => api.name.includes('-recreated-'));
        duplicates.push(...oldAPIs);
      }
    });
    
    return duplicates;
    
  } catch (error) {
    console.error(`❌ Error checking API Gateways: ${error.message}`);
    return [];
  }
}

async function findOrphanedRoute53Records() {
  console.log(`🔍 Checking for orphaned Route 53 records...`);
  
  try {
    // Get hosted zone ID
    const hostedZoneResult = execSync(
      `aws route53 list-hosted-zones --query "HostedZones[?Name=='${BASE_DOMAIN}.'].Id" --output text`,
      { encoding: 'utf8' }
    );
    
    const hostedZoneId = hostedZoneResult.trim().replace('/hostedzone/', '');
    if (!hostedZoneId) {
      console.log(`ℹ️  No hosted zone found for ${BASE_DOMAIN}`);
      return [];
    }
    
    console.log(`✅ Found hosted zone: ${hostedZoneId}`);
    
    // Get all records
    const recordsResult = execSync(
      `aws route53 list-resource-record-sets --hosted-zone-id ${hostedZoneId}`,
      { encoding: 'utf8' }
    );
    
    const records = JSON.parse(recordsResult).ResourceRecordSets;
    const orphanedRecords = [];
    
    // Check A records for our domains
    const aRecords = records.filter(record => 
      record.Type === 'A' && 
      record.AliasTarget &&
      (record.Name.includes(BASE_DOMAIN) || record.Name.includes('equip-track'))
    );
    
    console.log(`📊 Found ${aRecords.length} A records to check:`);
    
    for (const record of aRecords) {
      const domainName = record.Name.replace(/\.$/, ''); // Remove trailing dot
      console.log(`   🔍 Checking: ${domainName} → ${record.AliasTarget.DNSName}`);
      
      // Check if the target resource exists
      const targetDomain = record.AliasTarget.DNSName;
      
      if (targetDomain.includes('cloudfront.net')) {
        // CloudFront distribution
        try {
          const distributions = execSync(
            `aws cloudfront list-distributions --query "DistributionList.Items[?DomainName=='${targetDomain}'].Id" --output text`,
            { encoding: 'utf8', stdio: 'pipe' }
          );
          
          if (!distributions.trim()) {
            console.log(`     ❌ CloudFront distribution not found`);
            orphanedRecords.push({ record, reason: 'CloudFront distribution not found' });
          } else {
            console.log(`     ✅ CloudFront distribution exists`);
          }
        } catch (error) {
          console.log(`     ⚠️  Could not verify CloudFront distribution`);
        }
      } else if (targetDomain.includes('execute-api') || targetDomain.includes('amazonaws.com')) {
        // API Gateway or other AWS service
        try {
          // Try to resolve the DNS name
          execSync(`nslookup ${targetDomain}`, { stdio: 'pipe' });
          console.log(`     ✅ AWS service endpoint exists`);
        } catch (error) {
          console.log(`     ❌ AWS service endpoint not found`);
          orphanedRecords.push({ record, reason: 'AWS service endpoint not found' });
        }
      }
    }
    
    return orphanedRecords;
    
  } catch (error) {
    console.error(`❌ Error checking Route 53 records: ${error.message}`);
    return [];
  }
}

async function findOrphanedCustomDomains() {
  console.log(`🔍 Checking for orphaned custom domains...`);
  
  try {
    const result = execSync(`aws apigateway get-domain-names`, { encoding: 'utf8' });
    const domains = JSON.parse(result).items || [];
    
    const orphanedDomains = [];
    
    for (const domain of domains) {
      if (domain.domainName.includes(BASE_DOMAIN.replace('.com', ''))) {
        console.log(`   🔍 Checking custom domain: ${domain.domainName}`);
        
        try {
          // Check if domain has any base path mappings
          const mappingsResult = execSync(
            `aws apigateway get-base-path-mappings --domain-name ${domain.domainName}`,
            { encoding: 'utf8', stdio: 'pipe' }
          );
          
          const mappings = JSON.parse(mappingsResult).items || [];
          
          if (mappings.length === 0) {
            console.log(`     ❌ No base path mappings found`);
            orphanedDomains.push({ domain, reason: 'No base path mappings' });
          } else {
            console.log(`     ✅ Has ${mappings.length} base path mapping(s)`);
            
            // Check if the mapped APIs still exist
            for (const mapping of mappings) {
              try {
                execSync(
                  `aws apigateway get-rest-api --rest-api-id ${mapping.restApiId}`,
                  { stdio: 'pipe' }
                );
                console.log(`       ✅ API ${mapping.restApiId} exists`);
              } catch (error) {
                console.log(`       ❌ API ${mapping.restApiId} not found`);
                orphanedDomains.push({ 
                  domain, 
                  mapping, 
                  reason: `Mapped to non-existent API ${mapping.restApiId}` 
                });
              }
            }
          }
        } catch (error) {
          console.log(`     ❌ Error checking mappings: ${error.message}`);
        }
      }
    }
    
    return orphanedDomains;
    
  } catch (error) {
    console.error(`❌ Error checking custom domains: ${error.message}`);
    return [];
  }
}

async function deleteResource(type, resource, reason) {
  if (DRY_RUN) {
    console.log(`   🔥 Would delete ${type}: ${reason}`);
    return;
  }
  
  try {
    switch (type) {
      case 'api-gateway':
        console.log(`   🗑️  Deleting API Gateway: ${resource.name} (${resource.id})`);
        execSync(`aws apigateway delete-rest-api --rest-api-id ${resource.id}`, { stdio: 'inherit' });
        console.log(`   ✅ Deleted API Gateway: ${resource.id}`);
        break;
        
      case 'route53-record':
        console.log(`   🗑️  Would delete Route 53 record: ${resource.record.Name}`);
        console.log(`   ⚠️  Route 53 record deletion not implemented yet (manual cleanup required)`);
        break;
        
      case 'custom-domain':
        if (resource.mapping) {
          console.log(`   🗑️  Deleting base path mapping for: ${resource.domain.domainName}`);
          execSync(
            `aws apigateway delete-base-path-mapping --domain-name ${resource.domain.domainName} --base-path "${resource.mapping.basePath || ''}"`,
            { stdio: 'inherit' }
          );
        } else {
          console.log(`   🗑️  Deleting custom domain: ${resource.domain.domainName}`);
          execSync(`aws apigateway delete-domain-name --domain-name ${resource.domain.domainName}`, { stdio: 'inherit' });
        }
        console.log(`   ✅ Deleted custom domain resource`);
        break;
        
      default:
        console.log(`   ⚠️  Unknown resource type: ${type}`);
    }
  } catch (error) {
    console.error(`   ❌ Failed to delete ${type}: ${error.message}`);
  }
}

async function main() {
  console.log(`\n🔍 === SCANNING FOR DUPLICATE/ORPHANED RESOURCES ===\n`);
  
  // Find duplicate API Gateways
  const duplicateAPIs = await findDuplicateAPIGateways();
  
  // Find orphaned Route 53 records
  const orphanedRecords = await findOrphanedRoute53Records();
  
  // Find orphaned custom domains
  const orphanedDomains = await findOrphanedCustomDomains();
  
  console.log(`\n📊 === CLEANUP SUMMARY ===`);
  console.log(`🔸 Duplicate API Gateways: ${duplicateAPIs.length}`);
  console.log(`🔸 Orphaned Route 53 records: ${orphanedRecords.length}`);
  console.log(`🔸 Orphaned custom domains: ${orphanedDomains.length}`);
  
  const totalIssues = duplicateAPIs.length + orphanedRecords.length + orphanedDomains.length;
  
  if (totalIssues === 0) {
    console.log(`\n✅ No duplicate or orphaned resources found!`);
    return;
  }
  
  console.log(`\n🧹 === CLEANUP ACTIONS ===`);
  
  // Clean up duplicate API Gateways
  if (duplicateAPIs.length > 0) {
    console.log(`\n🔸 Duplicate API Gateways (${duplicateAPIs.length}):`);
    for (const api of duplicateAPIs) {
      await deleteResource('api-gateway', api, `Duplicate API for stage`);
    }
  }
  
  // Clean up orphaned Route 53 records
  if (orphanedRecords.length > 0) {
    console.log(`\n🔸 Orphaned Route 53 records (${orphanedRecords.length}):`);
    for (const record of orphanedRecords) {
      await deleteResource('route53-record', record, record.reason);
    }
  }
  
  // Clean up orphaned custom domains
  if (orphanedDomains.length > 0) {
    console.log(`\n🔸 Orphaned custom domains (${orphanedDomains.length}):`);
    for (const domain of orphanedDomains) {
      await deleteResource('custom-domain', domain, domain.reason);
    }
  }
  
  if (DRY_RUN) {
    console.log(`\n💡 To actually clean up these resources, run:`);
    console.log(`   DRY_RUN=false node scripts/cleanup-duplicate-resources.js`);
  } else {
    console.log(`\n✅ Cleanup completed!`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`\n💥 Cleanup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main }; 