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
    for (const [tableName, definition] of Object.entries(tableDefinitions)) {
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
          TableName: definition.tableName,
          KeySchema: definition.keySchema,
          AttributeDefinitions: definition.attributeDefinitions,
          GlobalSecondaryIndexes: definition.globalSecondaryIndexes,
          BillingMode: definition.billingMode,
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
