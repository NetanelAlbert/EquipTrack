import {
  AttributeDefinition,
  GlobalSecondaryIndex,
  KeySchemaElement,
} from '@aws-sdk/client-dynamodb';
import {
  ITEMS_BY_HOLDER_INDEX,
  ITEM_REPORT_HISTORY_INDEX,
  MAIN_TABLE_NAME,
  ORGANIZATION_TO_USERS_INDEX,
  REPORT_TABLE_NAME,
  TRANSACTIONS_INDEX,
} from '../constants';

export interface TableDefinition {
  tableName: string;
  keySchema: KeySchemaElement[];
  attributeDefinitions: AttributeDefinition[];
  globalSecondaryIndexes?: GlobalSecondaryIndex[];
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
}

export const tableDefinitions: Record<string, TableDefinition> = {
  Main: {
    tableName: MAIN_TABLE_NAME,
    keySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'holderId', AttributeType: 'S' },
      { AttributeName: 'organizationToUserQueryKey', AttributeType: 'S' },
      { AttributeName: 'transactionQueryKey', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: ITEMS_BY_HOLDER_INDEX,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'holderId', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: ORGANIZATION_TO_USERS_INDEX,
        KeySchema: [
          { AttributeName: 'organizationToUserQueryKey', KeyType: 'HASH' },
          { AttributeName: 'PK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: TRANSACTIONS_INDEX,
        KeySchema: [
          { AttributeName: 'transactionQueryKey', KeyType: 'HASH' },
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
