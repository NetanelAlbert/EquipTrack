const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  BatchWriteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { hashPreviewPassword } = require('./lib/preview-password-hash');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const STAGE = process.env.STAGE || 'local';

function dynamoEndpointFromEnv() {
  return (
    process.env.AWS_ENDPOINT_URL_DYNAMODB || process.env.AWS_ENDPOINT_URL || ''
  );
}

function stageTableName(base) {
  return STAGE === 'production' ? base : `${base}-${STAGE}`;
}

const USERS_AND_ORGANIZATIONS_TABLE_NAME = stageTableName(
  'UsersAndOrganizations'
);
const INVENTORY_TABLE_NAME = stageTableName('Inventory');
const FORMS_TABLE_NAME = stageTableName('Forms');
const REPORT_TABLE_NAME = stageTableName('EquipTrackReport');

const ORG_PREFIX = 'ORG#';
const USER_PREFIX = 'USER#';
const PRODUCT_PREFIX = 'PRODUCT#';
const UPI_PREFIX = 'UPI#';
const HOLDER_PREFIX = 'HOLDER#';
const FORM_PREFIX = 'FORM#';
const DATE_PREFIX = 'DATE#';
const ITEM_KEY_PREFIX = 'ITEM_KEY#';
const WAREHOUSE_SUFFIX = 'WAREHOUSE';
const METADATA_SK = 'METADATA';
const ORGANIZATION_TO_USERS_INDEX = 'OrganizationToUsersIndex';

/**
 * LocalStack / dev tables are often reused across runs. Old UserInOrganization (UIO)
 * rows with random UUIDs break OrganizationToUsersIndex queries until removed.
 */
async function deleteOrgUserMemberships(docClient, tableName, organizationId) {
  const keysToDelete = [];
  let lastKey;

  do {
    const page = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: ORGANIZATION_TO_USERS_INDEX,
        KeyConditionExpression:
          'organizationId = :orgId AND begins_with(PK, :userPrefix)',
        ExpressionAttributeValues: {
          ':orgId': organizationId,
          ':userPrefix': USER_PREFIX,
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of page.Items ?? []) {
      if (item.PK && item.SK) {
        keysToDelete.push({ PK: item.PK, SK: item.SK });
      }
    }
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);

  for (let i = 0; i < keysToDelete.length; i += 25) {
    const chunk = keysToDelete.slice(i, i + 25);
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((key) => ({
            DeleteRequest: { Key: key },
          })),
        },
      })
    );
  }

  if (keysToDelete.length > 0) {
    console.log(
      `[seed-e2e-data] Removed ${keysToDelete.length} stale UIO row(s) for org ${organizationId}`
    );
  }
}

function createDynamoClient() {
  const clientConfig = { region: AWS_REGION };
  const endpoint = dynamoEndpointFromEnv();

  if (endpoint) {
    clientConfig.endpoint = endpoint;
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

const E2E_ORGANIZATION_ID = 'org-e2e-main';

const E2E_SEED_USERS = [
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
  {
    id: 'user-e2e-inspector',
    name: 'E2E Inspector',
    email: 'e2e.inspector@example.com',
    state: 'active',
    role: 'inspector',
  },
];

async function putStandardE2eOrganizationUsers(docClient) {
  const organizationId = E2E_ORGANIZATION_ID;

  const previewSeedPassword = process.env.PREVIEW_SEED_PASSWORD;
  const featurePreviewPasswordHash =
    typeof previewSeedPassword === 'string' && previewSeedPassword.length > 0
      ? hashPreviewPassword(previewSeedPassword)
      : undefined;
  if (featurePreviewPasswordHash) {
    console.log(
      '[seed-e2e-data] PREVIEW_SEED_PASSWORD set — storing featurePreviewPasswordHash on seeded users'
    );
  }

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

  for (const user of E2E_SEED_USERS) {
    await putItem(docClient, USERS_AND_ORGANIZATIONS_TABLE_NAME, {
      id: user.id,
      name: user.name,
      email: user.email,
      state: user.state,
      PK: `${USER_PREFIX}${user.id}`,
      SK: METADATA_SK,
      dbItemType: 'USER',
      ...(featurePreviewPasswordHash && {
        featurePreviewPasswordHash,
      }),
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
}

/**
 * Reset org metadata + user list for the main E2E org (removes invited/extra UIO rows).
 * Safe to call mid-suite; does not touch inventory/forms.
 */
async function reseedE2eOrgUsers() {
  const docClient = createDynamoClient();
  await deleteOrgUserMemberships(
    docClient,
    USERS_AND_ORGANIZATIONS_TABLE_NAME,
    E2E_ORGANIZATION_ID
  );
  await putStandardE2eOrganizationUsers(docClient);
  console.log('[seed-e2e-data] reseedE2eOrgUsers completed');
}

async function seedE2eData() {
  console.log(`[seed-e2e-data] Seeding stage=${STAGE}, region=${AWS_REGION}`);
  const docClient = createDynamoClient();

  const organizationId = E2E_ORGANIZATION_ID;

  await deleteOrgUserMemberships(
    docClient,
    USERS_AND_ORGANIZATIONS_TABLE_NAME,
    organizationId
  );

  await putStandardE2eOrganizationUsers(docClient);

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

  // ── Forms ───────────────────────────────────────────
  const now = Date.now();
  const customerUserId = 'user-e2e-customer';
  const adminUserId = 'user-e2e-admin';
  const formItems = [
    { productId: 'prod-bulk-helmet', quantity: 1 },
  ];

  const forms = [
    {
      formID: 'form-e2e-pending-checkout',
      userID: customerUserId,
      organizationID: organizationId,
      type: 'check-out',
      status: 'pending',
      items: formItems,
      description: 'e2e-seed-pending-checkout',
      createdAtTimestamp: now - 3000,
      lastUpdated: now - 3000,
      createdByUserId: adminUserId,
    },
    {
      formID: 'form-e2e-approved-checkout',
      userID: customerUserId,
      organizationID: organizationId,
      type: 'check-out',
      status: 'approved',
      items: formItems,
      description: 'e2e-seed-approved-checkout',
      createdAtTimestamp: now - 60000,
      lastUpdated: now - 50000,
      createdByUserId: adminUserId,
      approvedAtTimestamp: now - 50000,
      approvedByUserId: adminUserId,
    },
    {
      formID: 'form-e2e-rejected-checkin',
      userID: customerUserId,
      organizationID: organizationId,
      type: 'check-in',
      status: 'rejected',
      items: formItems,
      description: 'e2e-seed-rejected-checkin',
      createdAtTimestamp: now - 120000,
      lastUpdated: now - 110000,
      createdByUserId: adminUserId,
      rejectionReason: 'wrong items',
      rejectionAtTimestamp: now - 110000,
      rejectionByUserId: adminUserId,
    },
  ];

  for (const form of forms) {
    await putItem(docClient, FORMS_TABLE_NAME, {
      PK: `${ORG_PREFIX}${organizationId}#${USER_PREFIX}${form.userID}`,
      SK: `${FORM_PREFIX}${form.formID}`,
      dbItemType: 'FORM',
      organizationId: `${ORG_PREFIX}${organizationId}`,
      ...form,
    });
  }

  // ── Predefined form ────────────────────────────────
  await putItem(docClient, FORMS_TABLE_NAME, {
    PK: `${ORG_PREFIX}${organizationId}`,
    SK: `${FORM_PREFIX}predefined-e2e-kit`,
    dbItemType: 'PREDEFINED_FORM',
    organizationID: organizationId,
    formID: 'predefined-e2e-kit',
    description: 'E2E Standard Kit',
    items: [
      { productId: 'prod-bulk-helmet', quantity: 1 },
      { productId: 'prod-upi-laptop', quantity: 1 },
    ],
  });

  // ── Report for today ──────────────────────────────
  const todayDate = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

  const reportItems = [
    {
      productId: 'prod-upi-laptop',
      upi: 'LAP-WH-001',
      location: 'Building A, Room 101',
      reportedBy: adminUserId,
      reportDate: todayDate,
    },
    {
      productId: 'prod-upi-laptop',
      upi: 'LAP-WH-002',
      location: 'Building B, Room 205',
      reportedBy: adminUserId,
      reportDate: todayDate,
    },
  ];

  const reportPutRequests = reportItems.map((item) => {
    const itemKey = `${PRODUCT_PREFIX}${item.productId}#${UPI_PREFIX}#${item.upi}`;
    return {
      PutRequest: {
        Item: {
          orgDailyReportId: `${ORG_PREFIX}${organizationId}#${DATE_PREFIX}${todayDate}`,
          itemKey,
          itemOrgKey: `${ORG_PREFIX}${organizationId}#${ITEM_KEY_PREFIX}${itemKey}`,
          reportDate: todayDate,
          ...item,
        },
      },
    };
  });

  await docClient.send(
    new BatchWriteCommand({
      RequestItems: {
        [REPORT_TABLE_NAME]: reportPutRequests,
      },
    })
  );

  console.log('[seed-e2e-data] Seed completed successfully');
}

module.exports = {
  seedE2eData,
  reseedE2eOrgUsers,
};

if (require.main === module) {
  seedE2eData().catch((error) => {
    console.error('[seed-e2e-data] Failed:', error);
    process.exit(1);
  });
}
