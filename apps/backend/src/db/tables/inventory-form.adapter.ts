import { BaseAdapter } from './base.adapter';
import { InventoryForm } from '@equip-track/shared';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

export class InventoryFormAdapter extends BaseAdapter<InventoryForm> {
  constructor() {
    super('InventoryForm');
  }

  private readonly ORGANIZATION_INDEX = 'OrganizationIndex';

  protected getKey(item: Partial<InventoryForm>): Record<string, any> {
    return {
      userID: item.userID,
      formID: item.formID,
    };
  }

  async getByOrganization(organizationID: string): Promise<InventoryForm[]> {
    const params = {
      TableName: this.tableName,
      IndexName: this.ORGANIZATION_INDEX,
      KeyConditionExpression: 'organizationID = :orgId',
      ExpressionAttributeValues: {
        ':orgId': organizationID,
      },
    };

    const result = await this.docClient.send(new QueryCommand(params));
    return result.Items as InventoryForm[];
  }

  async getByUser(organizationID: string, userID: string): Promise<InventoryForm[]> {
    const params = {
      TableName: this.tableName,
      IndexName: this.ORGANIZATION_INDEX,
      KeyConditionExpression: 'organizationID = :orgId AND userID = :userId',
      ExpressionAttributeValues: {
        ':orgId': organizationID,
        ':userId': userID,
      },
    };

    const result = await this.docClient.send(new QueryCommand(params));
    return result.Items as InventoryForm[];
  }
}
