import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

export abstract class BaseAdapter<T> {
  protected readonly client: DynamoDBClient;
  protected readonly docClient: DynamoDBDocumentClient;
  protected readonly tableName: string;

  constructor(tableName: string) {
    this.client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(this.client);
    this.tableName = tableName;
  }

  protected abstract getKey(item: Partial<T>): Record<string, any>;

  async get(key: Partial<T>): Promise<T | null> {
    const params = {
      TableName: this.tableName,
      Key: this.getKey(key),
    };

    const result = await this.docClient.send(new GetCommand(params));
    return (result.Item as T) || null;
  }

  async put(item: T): Promise<void> {
    const params = {
      TableName: this.tableName,
      Item: item,
    };

    await this.docClient.send(new PutCommand(params));
  }

  async delete(key: Partial<T>): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: this.getKey(key),
    };

    await this.docClient.send(new DeleteCommand(params));
  }

  async update(key: Partial<T>, updates: Partial<T>): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    const params = {
      TableName: this.tableName,
      Key: this.getKey(key),
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    };

    await this.docClient.send(new UpdateCommand(params));
  }
}
