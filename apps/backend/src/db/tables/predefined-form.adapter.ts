import { BaseAdapter } from './base.adapter';
import { PredefinedForm } from '@equip-track/shared';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

export class PredefinedFormAdapter extends BaseAdapter<PredefinedForm> {
  constructor() {
    super('PredefinedForm');
  }

  protected getKey(item: Partial<PredefinedForm>): Record<string, any> {
    return {
      organizationID: item.organizationID,
      formID: item.formID,
    };
  }

  async getByOrganization(organizationID: string): Promise<PredefinedForm[]> {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'organizationID = :orgId',
      ExpressionAttributeValues: {
        ':orgId': organizationID,
      },
    };

    const result = await this.docClient.send(new QueryCommand(params));
    return result.Items as PredefinedForm[];
  }
}
