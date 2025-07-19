import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import { tableDefinitions } from './table-definitions';

// Environment variables
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const STAGE = process.env.STAGE || 'dev';

export class TableCreator {
  private client: DynamoDBClient;

  constructor() {
    this.client = new DynamoDBClient({
      region: AWS_REGION,
    });
  }

  async createTables(): Promise<void> {
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
