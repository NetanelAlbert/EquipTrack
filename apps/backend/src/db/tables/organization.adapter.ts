import { BaseAdapter } from './base.adapter';
import { Organization } from '@equip-track/shared';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

export class OrganizationAdapter extends BaseAdapter<Organization> {
  constructor() {
    super('Organization');
  }

  protected getKey(item: Partial<Organization>): Record<string, any> {
    return {
      id: item.id,
    };
  }

  async getByWarehouseUser(
    warehouseUserID: string
  ): Promise<Organization | null> {
    const params = {
      TableName: this.tableName,
      IndexName: 'WarehouseUserIndex',
      KeyConditionExpression: 'warehouseUserID = :userId',
      ExpressionAttributeValues: {
        ':userId': warehouseUserID,
      },
    };

    const result = await this.docClient.send(new QueryCommand(params));
    return (result.Items?.[0] as Organization) || null;
  }
}
