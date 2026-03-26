#!/usr/bin/env node
const fs = require('fs');

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';

function loadEndpointMetas() {
  console.log('🔍 Loading endpoint definitions...');
  
  // Try to load from built files first
  try {
    const { endpointMetas } = require('../libs/shared/src/api/endpoints');
    console.log('✅ Loaded endpoints from built files');
    return endpointMetas;
  } catch (_) {
    console.log('⚠️  Could not load from built files, trying source files via ts-node...');
  }

  // Try to load from source TypeScript files using ts-node
  try {
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'commonjs'
      }
    });
    const { endpointMetas } = require('../libs/shared/src/api/endpoints');
    console.log('✅ Loaded endpoints from source files');
    return endpointMetas;
  } catch (error) {
    console.log('⚠️  Could not load from source files, using fallback definitions:', error.message);
  }
  
  // Fallback to hardcoded definitions
  const fallbackEndpoints = {
    // Admin Users
    getUsers: {
      path: '/api/organizations/{organizationId}/users',
      method: 'GET',
      allowedRoles: ['Admin']
    },
    setUser: {
      path: '/api/organizations/{organizationId}/users',
      method: 'POST',
      allowedRoles: ['Admin']
    },
    // Basic User
    start: {
      path: '/api/users/{userId}/start',
      method: 'GET',
      allowedRoles: ['Admin', 'Customer', 'WarehouseManager']
    },
    approveCheckOut: {
      path: '/api/organizations/{organizationId}/checkout/approve',
      method: 'POST',
      allowedRoles: ['WarehouseManager', 'Admin', 'Customer']
    },
    rejectCheckOut: {
      path: '/api/organizations/{organizationId}/checkout/reject',
      method: 'POST',
      allowedRoles: ['WarehouseManager', 'Admin', 'Customer']
    },
    requestCheckIn: {
      path: '/api/organizations/{organizationId}/checkin/request',
      method: 'POST',
      allowedRoles: ['Customer', 'Admin', 'WarehouseManager']
    },
    // Warehouse
    setProduct: {
      path: '/api/organizations/{organizationId}/products/set',
      method: 'POST',
      allowedRoles: ['WarehouseManager', 'Admin']
    },
    deleteProduct: {
      path: '/api/organizations/{organizationId}/products/delete',
      method: 'POST',
      allowedRoles: ['WarehouseManager', 'Admin']
    },
    addInventory: {
      path: '/api/organizations/{organizationId}/inventory/add',
      method: 'POST',
      allowedRoles: ['WarehouseManager', 'Admin']
    },
    removeInventory: {
      path: '/api/organizations/{organizationId}/inventory/remove',
      method: 'POST',
      allowedRoles: ['WarehouseManager', 'Admin']
    },
    getInventory: {
      path: '/api/organizations/{organizationId}/inventory',
      method: 'GET',
      allowedRoles: ['WarehouseManager', 'Admin']
    },
    getUserInventory: {
      path: '/api/organizations/{organizationId}/inventory/user/{userId}',
      method: 'GET',
      allowedRoles: ['WarehouseManager', 'Admin', 'Customer']
    },
    createCheckOutForm: {
      path: '/api/organizations/{organizationId}/checkout/create',
      method: 'POST',
      allowedRoles: ['WarehouseManager', 'Admin']
    },
    // Reports
    getReports: {
      path: '/api/organizations/{organizationId}/reports',
      method: 'GET',
      allowedRoles: ['WarehouseManager', 'Admin']
    },
    getReportsByDates: {
      path: '/api/organizations/{organizationId}/reports/by-dates',
      method: 'POST',
      allowedRoles: ['WarehouseManager', 'Admin']
    },
    publishPartialReport: {
      path: '/api/organizations/{organizationId}/reports/publish',
      method: 'POST',
      allowedRoles: ['WarehouseManager', 'Admin']
    },
    getItemsToReport: {
      path: '/api/organizations/{organizationId}/reports/items-to-report',
      method: 'GET',
      allowedRoles: ['WarehouseManager', 'Admin', 'Customer']
    }
  };
  console.log('🔍 Fallback endpoints:', fallbackEndpoints);

  return fallbackEndpoints;
}

function createEndpointsConfig(endpointMetas) {
  console.log('📝 Creating endpoints configuration file...');
  
  const config = {
    metadata: {
      generated: new Date().toISOString(),
      stage: STAGE,
      region: AWS_REGION,
      totalEndpoints: Object.keys(endpointMetas).length
    },
    endpoints: endpointMetas,
    handlerNames: Object.keys(endpointMetas)
  };
  
  fs.writeFileSync('endpoints-config.json', JSON.stringify(config, null, 2));
  console.log(`✅ Created endpoints-config.json with ${config.handlerNames.length} endpoints`);
  
  return config;
}

function createInitialDeploymentInfo() {
  console.log('📝 Creating initial deployment info...');
  
  const deploymentInfo = {
    metadata: {
      created: new Date().toISOString(),
      stage: STAGE,
      region: AWS_REGION,
      version: '1.0.0'
    },
    stage: STAGE,
    region: AWS_REGION,
    status: 'initializing',
    backend: {
      lambdas: {
        functions: [],
        role: null,
        status: 'pending'
      },
      apiGateway: {
        apiId: null,
        apiUrl: null,
        status: 'pending'
      },
      dynamodb: {
        tables: ['UsersAndOrganizations', 'Inventory', 'Forms', 'Reports'],
        status: 'pending'
      }
    },
    frontend: {
      s3: {
        bucketName: null,
        s3WebsiteUrl: null,
        status: 'pending'
      },
      cloudfront: {
        distributionId: null,
        cloudfrontUrl: null,
        status: 'pending'
      }
    }
  };

  return deploymentInfo;
}

function prepareDeployment() {
  console.log('🚀 Preparing deployment configuration...');
  console.log(`📍 Stage: ${STAGE}`);
  console.log(`🌍 Region: ${AWS_REGION}`);
  
  try {
    // Load endpoint definitions
    const endpointMetas = loadEndpointMetas();
    
    // Create endpoints config file
    const endpointsConfig = createEndpointsConfig(endpointMetas);
    
    // Create initial deployment info (gitignored; CI starts with no file)
    const deploymentInfo = createInitialDeploymentInfo();

    try {
      const { hydrateFrontendInfraFromAws } = require('./setup-cloudfront.js');
      hydrateFrontendInfraFromAws(deploymentInfo);
    } catch (e) {
      console.log('⚠️ Frontend infra hydration skipped:', e.message);
    }

    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('✅ Wrote deployment-info.json');

    console.log('\n🎉 Deployment preparation completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - ${endpointsConfig.handlerNames.length} API endpoints configured`);
    console.log(`   - Stage: ${STAGE}`);
    console.log(`   - Region: ${AWS_REGION}`);
    console.log(`   - Config files: endpoints-config.json, deployment-info.json`);
    
    return {
      endpointsConfig,
      deploymentInfo
    };
    
  } catch (error) {
    console.error('❌ Failed to prepare deployment:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  prepareDeployment();
}

module.exports = { prepareDeployment, loadEndpointMetas }; 