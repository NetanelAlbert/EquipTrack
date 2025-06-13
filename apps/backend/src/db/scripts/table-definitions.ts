import {
  AttributeDefinition,
  GlobalSecondaryIndex,
  KeySchemaElement,
  TableDescription,
} from '@aws-sdk/client-dynamodb';

export interface TableDefinition {
  tableName: string;
  keySchema: KeySchemaElement[];
  attributeDefinitions: AttributeDefinition[];
  globalSecondaryIndexes?: GlobalSecondaryIndex[];
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
}

export const tableDefinitions: Record<string, TableDefinition> = {
  InventoryForm: {
    tableName: 'InventoryForm',
    keySchema: [
      { AttributeName: 'userID', KeyType: 'HASH' },
      { AttributeName: 'formID', KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'userID', AttributeType: 'S' },
      { AttributeName: 'formID', AttributeType: 'S' },
      { AttributeName: 'organizationID', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: 'OrganizationIndex',
        KeySchema: [
          { AttributeName: 'organizationID', KeyType: 'HASH' },
          { AttributeName: 'userID', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
  },
  PredefinedForm: {
    tableName: 'PredefinedForm',
    keySchema: [
      { AttributeName: 'organizationID', KeyType: 'HASH' },
      { AttributeName: 'formID', KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'organizationID', AttributeType: 'S' },
      { AttributeName: 'formID', AttributeType: 'S' },
    ],
    billingMode: 'PAY_PER_REQUEST',
  },
  Organization: {
    tableName: 'Organization',
    keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    attributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
    ],
    billingMode: 'PAY_PER_REQUEST',
  },
  Inventory: {
    tableName: 'Inventory',
    keySchema: [
      { AttributeName: 'organizationID', KeyType: 'HASH' },
      { AttributeName: 'userID', KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'organizationID', AttributeType: 'S' },
      { AttributeName: 'userID', AttributeType: 'S' },
    ],
    billingMode: 'PAY_PER_REQUEST',
  },
};
