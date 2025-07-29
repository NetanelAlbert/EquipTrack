const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} = require('@aws-sdk/client-dynamodb');

// Environment variables
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const STAGE = process.env.STAGE || 'dev';

// Constants
const USERS_AND_ORGANIZATIONS_TABLE_NAME = 'UsersAndOrganizations';
const INVENTORY_TABLE_NAME = 'Inventory';
const FORMS_TABLE_NAME = 'Forms';
const REPORT_TABLE_NAME = 'EquipTrackReport';

const ITEMS_BY_HOLDER_INDEX = 'ItemsByHolderIndex';
const ITEMS_BY_HOLDER_INDEX_HOLDER_PK = 'holderIdQueryKey';
const PRODUCTS_BY_ORGANIZATION_INDEX = 'ProductsByOrganizationIndex';
const PRODUCTS_BY_ORGANIZATION_INDEX_PK = 'organizationId';
const FORMS_BY_ORGANIZATION_INDEX = 'FormsByOrganizationIndex';
const ITEM_REPORT_HISTORY_INDEX = 'ItemReportHistoryIndex';
const USERS_BY_EMAIL_INDEX = 'UsersByEmailIndex';
const ORGANIZATION_TO_USERS_INDEX = 'OrganizationToUsersIndex';
const ORGANIZATION_TO_USERS_INDEX_PK = 'organizationId';
const ORGANIZATION_TO_USERS_INDEX_SK = 'PK';

// Table Definitions
const tableDefinitions = {
  UsersAndOrganizations: {
    tableName: USERS_AND_ORGANIZATIONS_TABLE_NAME,
    keySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
      { AttributeName: ORGANIZATION_TO_USERS_INDEX_PK, AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: USERS_BY_EMAIL_INDEX,
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: ORGANIZATION_TO_USERS_INDEX,
        KeySchema: [
          { AttributeName: ORGANIZATION_TO_USERS_INDEX_PK, KeyType: 'HASH' },
          { AttributeName: ORGANIZATION_TO_USERS_INDEX_SK, KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
  },
  Inventory: {
    tableName: INVENTORY_TABLE_NAME,
    keySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: ITEMS_BY_HOLDER_INDEX_HOLDER_PK, AttributeType: 'S' },
      { AttributeName: PRODUCTS_BY_ORGANIZATION_INDEX_PK, AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: ITEMS_BY_HOLDER_INDEX,
        KeySchema: [
          { AttributeName: ITEMS_BY_HOLDER_INDEX_HOLDER_PK, KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: PRODUCTS_BY_ORGANIZATION_INDEX,
        KeySchema: [
          { AttributeName: PRODUCTS_BY_ORGANIZATION_INDEX_PK, KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
  },
  Forms: {
    tableName: FORMS_TABLE_NAME,
    keySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'organizationId', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: FORMS_BY_ORGANIZATION_INDEX,
        KeySchema: [
          { AttributeName: 'organizationId', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
  },
  EquipTrackReport: {
    tableName: REPORT_TABLE_NAME,
    keySchema: [
      { AttributeName: 'orgDailyReportId', KeyType: 'HASH' },
      { AttributeName: 'itemKey', KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'orgDailyReportId', AttributeType: 'S' },
      { AttributeName: 'itemKey', AttributeType: 'S' },
      { AttributeName: 'itemOrgKey', AttributeType: 'S' },
      { AttributeName: 'reportDate', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: ITEM_REPORT_HISTORY_INDEX,
        KeySchema: [
          { AttributeName: 'itemOrgKey', KeyType: 'HASH' },
          { AttributeName: 'reportDate', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
  },
};

class TableCreator {
  constructor() {
    this.client = new DynamoDBClient({
      region: AWS_REGION,
    });
  }

  async createTables() {
    console.log(
      `🚀 Creating DynamoDB tables for stage: ${STAGE} in region: ${AWS_REGION}`
    );

    for (const definition of Object.values(tableDefinitions)) {
      // Add stage suffix to table names for environment isolation
      const stageTableName =
        STAGE === 'production'
          ? definition.tableName
          : `${definition.tableName}-${STAGE}`;

      const {
        keySchema,
        attributeDefinitions,
        globalSecondaryIndexes,
        billingMode,
      } = definition;

      try {
        // Check if table exists
        try {
          await this.client.send(
            new DescribeTableCommand({ TableName: stageTableName })
          );
          console.log(`✅ Table ${stageTableName} already exists`);
          continue;
        } catch (error) {
          // Table doesn't exist, proceed with creation
          console.log(`📝 Creating table ${stageTableName}...`);
        }

        const command = new CreateTableCommand({
          TableName: stageTableName,
          KeySchema: keySchema,
          AttributeDefinitions: attributeDefinitions,
          GlobalSecondaryIndexes: globalSecondaryIndexes,
          BillingMode: billingMode,
        });

        await this.client.send(command);
        console.log(`✅ Created table ${stageTableName}`);
      } catch (error) {
        console.error(`❌ Error creating table ${stageTableName}:`, error);
        throw error;
      }
    }

    console.log('🎉 All tables created successfully!');
  }
}

async function main() {
  const creator = new TableCreator();
  try {
    await creator.createTables();
    console.log('All tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  }
}

main(); 