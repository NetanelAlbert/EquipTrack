import {
  AttributeDefinition,
  GlobalSecondaryIndex,
  KeySchemaElement,
} from '@aws-sdk/client-dynamodb';
import {
  ITEMS_BY_HOLDER_INDEX,
  ITEMS_BY_HOLDER_INDEX_HOLDER_PK,
  ITEM_REPORT_HISTORY_INDEX,
  REPORT_TABLE_NAME,
  USERS_AND_ORGANIZATIONS_TABLE_NAME,
  INVENTORY_TABLE_NAME,
  FORMS_TABLE_NAME,
  FORMS_BY_ORGANIZATION_INDEX,
  PRODUCTS_BY_ORGANIZATION_INDEX,
  PRODUCTS_BY_ORGANIZATION_INDEX_PK,
} from '../constants';

export interface TableDefinition {
  tableName: string;
  keySchema: KeySchemaElement[];
  attributeDefinitions: AttributeDefinition[];
  globalSecondaryIndexes?: GlobalSecondaryIndex[];
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
}

export const tableDefinitions: Record<string, TableDefinition> = {
  UsersAndOrganizations: {
    tableName: USERS_AND_ORGANIZATIONS_TABLE_NAME,
    keySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
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
  Reports: {
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
