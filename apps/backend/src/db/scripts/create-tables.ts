import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import { tableDefinitions } from './table-definitions';

export class TableCreator {
  private client: DynamoDBClient;

  constructor() {
    this.client = new DynamoDBClient({});
  }

  async createTables(): Promise<void> {
    for (const definition of Object.values(tableDefinitions)) {
      const { tableName, keySchema, attributeDefinitions, globalSecondaryIndexes, billingMode } = definition;
      try {
        // Check if table exists
        try {
          await this.client.send(
            new DescribeTableCommand({ TableName: tableName })
          );
          console.log(`Table ${tableName} already exists`);
          continue;
        } catch (error) {
          // Table doesn't exist, proceed with creation
        }

        const command = new CreateTableCommand({
          TableName: tableName,
          KeySchema: keySchema,
          AttributeDefinitions: attributeDefinitions,
          GlobalSecondaryIndexes: globalSecondaryIndexes,
          BillingMode: billingMode,
        });

        await this.client.send(command);
        console.log(`Created table ${tableName}`);
      } catch (error) {
        console.error(`Error creating table ${tableName}:`, error);
        throw error;
      }
    }
  }
}
