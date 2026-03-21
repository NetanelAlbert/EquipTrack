const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const STAGE = process.env.STAGE || 'local';
const DYNAMODB_ENDPOINT =
  process.env.AWS_ENDPOINT_URL_DYNAMODB || process.env.AWS_ENDPOINT_URL;

function stageTableName(base) {
  return STAGE === 'production' ? base : `${base}-${STAGE}`;
}

const USERS_AND_ORGANIZATIONS_TABLE_NAME = stageTableName(
  'UsersAndOrganizations'
);
const INVENTORY_TABLE_NAME = stageTableName('Inventory');

const ORG_PREFIX = 'ORG#';
const USER_PREFIX = 'USER#';
const PRODUCT_PREFIX = 'PRODUCT#';
const UPI_PREFIX = 'UPI#';
const HOLDER_PREFIX = 'HOLDER#';
const WAREHOUSE_SUFFIX = 'WAREHOUSE';
const METADATA_SK = 'METADATA';

function createDynamoClient() {
  const clientConfig = { region: AWS_REGION };

  if (DYNAMODB_ENDPOINT) {
    clientConfig.endpoint = DYNAMODB_ENDPOINT;
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    };
  }

  const client = new DynamoDBClient(clientConfig);
  return DynamoDBDocumentClient.from(client);
}

async function putItem(docClient, tableName, item) {
  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    })
  );
}

async function seedE2eData() {
  console.log(`[seed-e2e-data] Seeding stage=${STAGE}, region=${AWS_REGION}`);
  const docClient = createDynamoClient();

  const organizationId = 'org-e2e-main';
  const users = [
    {
      id: 'user-e2e-admin',
      name: 'E2E Admin',
      email: 'e2e.admin@example.com',
      state: 'active',
      role: 'admin',
    },
    {
      id: 'user-e2e-warehouse',
      name: 'E2E Warehouse',
      email: 'e2e.warehouse@example.com',
      state: 'active',
      role: 'warehouse-manager',
    },
    {
      id: 'user-e2e-customer',
      name: 'E2E Customer',
      email: 'e2e.customer@example.com',
      state: 'active',
      role: 'customer',
    },
  ];

  const organization = {
    id: organizationId,
    name: 'EquipTrack E2E Organization',
    imageUrl: null,
    departments: [
      {
        id: 'dep-ops',
        name: 'Operations',
      },
    ],
  };

  await putItem(docClient, USERS_AND_ORGANIZATIONS_TABLE_NAME, {
    ...organization,
    PK: `${ORG_PREFIX}${organization.id}`,
    SK: METADATA_SK,
    dbItemType: 'ORG',
  });

  for (const user of users) {
    await putItem(docClient, USERS_AND_ORGANIZATIONS_TABLE_NAME, {
      id: user.id,
      name: user.name,
      email: user.email,
      state: user.state,
      PK: `${USER_PREFIX}${user.id}`,
      SK: METADATA_SK,
      dbItemType: 'USER',
    });

    await putItem(docClient, USERS_AND_ORGANIZATIONS_TABLE_NAME, {
      organizationId,
      userId: user.id,
      role: user.role,
      PK: `${USER_PREFIX}${user.id}`,
      SK: `${ORG_PREFIX}${organizationId}`,
      dbItemType: 'UIO',
    });
  }

  const products = [
    {
      id: 'prod-bulk-helmet',
      name: 'Safety Helmet',
      hasUpi: false,
    },
    {
      id: 'prod-upi-laptop',
      name: 'Laptop',
      hasUpi: true,
    },
  ];

  for (const product of products) {
    await putItem(docClient, INVENTORY_TABLE_NAME, {
      ...product,
      PK: `${ORG_PREFIX}${organizationId}`,
      SK: `${PRODUCT_PREFIX}${product.id}`,
      dbItemType: 'PRODUCT',
      organizationId: `${ORG_PREFIX}${organizationId}`,
    });
  }

  await putItem(docClient, INVENTORY_TABLE_NAME, {
    PK: `${ORG_PREFIX}${organizationId}`,
    SK: `${PRODUCT_PREFIX}prod-bulk-helmet#${HOLDER_PREFIX}#${WAREHOUSE_SUFFIX}`,
    dbItemType: 'INVENTORY_BULK_ITEM',
    productId: 'prod-bulk-helmet',
    quantity: 20,
    organizationId,
    holderId: WAREHOUSE_SUFFIX,
    holderIdQueryKey: `${HOLDER_PREFIX}${organizationId}#${WAREHOUSE_SUFFIX}`,
  });

  await putItem(docClient, INVENTORY_TABLE_NAME, {
    PK: `${ORG_PREFIX}${organizationId}`,
    SK: `${PRODUCT_PREFIX}prod-bulk-helmet#${HOLDER_PREFIX}#user-e2e-customer`,
    dbItemType: 'INVENTORY_BULK_ITEM',
    productId: 'prod-bulk-helmet',
    quantity: 3,
    organizationId,
    holderId: 'user-e2e-customer',
    holderIdQueryKey: `${HOLDER_PREFIX}${organizationId}#user-e2e-customer`,
  });

  const warehouseUpis = ['LAP-WH-001', 'LAP-WH-002', 'LAP-WH-003'];
  for (const upi of warehouseUpis) {
    await putItem(docClient, INVENTORY_TABLE_NAME, {
      PK: `${ORG_PREFIX}${organizationId}`,
      SK: `${PRODUCT_PREFIX}prod-upi-laptop#${UPI_PREFIX}#${upi}`,
      dbItemType: 'INVENTORY_UNIQUE_ITEM',
      productId: 'prod-upi-laptop',
      upi,
      organizationId,
      holderId: WAREHOUSE_SUFFIX,
      holderIdQueryKey: `${HOLDER_PREFIX}${organizationId}#${WAREHOUSE_SUFFIX}`,
    });
  }

  await putItem(docClient, INVENTORY_TABLE_NAME, {
    PK: `${ORG_PREFIX}${organizationId}`,
    SK: `${PRODUCT_PREFIX}prod-upi-laptop#${UPI_PREFIX}#LAP-CUST-001`,
    dbItemType: 'INVENTORY_UNIQUE_ITEM',
    productId: 'prod-upi-laptop',
    upi: 'LAP-CUST-001',
    organizationId,
    holderId: 'user-e2e-customer',
    holderIdQueryKey: `${HOLDER_PREFIX}${organizationId}#user-e2e-customer`,
  });

  console.log('[seed-e2e-data] Seed completed successfully');
}

module.exports = {
  seedE2eData,
};

if (require.main === module) {
  seedE2eData().catch((error) => {
    console.error('[seed-e2e-data] Failed:', error);
    process.exit(1);
  });
}
