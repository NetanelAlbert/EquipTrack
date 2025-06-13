import { BaseAdapter } from './base.adapter';
import { Inventory } from '@equip-track/shared';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

export class InventoryAdapter extends BaseAdapter<Inventory> {
  constructor() {
    super('Inventory');
  }

  protected getKey(item: Partial<Inventory>): Record<string, any> {
    return {
      organizationID: item.organizationID,
      userID: item.userID,
    };
  }

  async getByOrganization(organizationID: string): Promise<Inventory[]> {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'organizationID = :orgId',
      ExpressionAttributeValues: {
        ':orgId': organizationID,
      },
    };

    const result = await this.docClient.send(new QueryCommand(params));
    return result.Items as Inventory[];
  }

  async getByUser(organizationID: string, userID: string): Promise<Inventory[]> {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'organizationID = :orgId AND userID = :userId',
      ExpressionAttributeValues: {
        ':orgId': organizationID,
        ':userId': userID,
      },
    };

    const result = await this.docClient.send(new QueryCommand(params));
    return result.Items as Inventory[];
  }
}
