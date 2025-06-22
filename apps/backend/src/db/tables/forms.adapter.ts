/**
 * This adapter is used to access the Forms table
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DbKey, DbItemType } from '../models';
import {
  DynamoDBDocumentClient,
  BatchGetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  FORMS_TABLE_NAME,
  USER_PREFIX,
  ORG_PREFIX,
  FORM_PREFIX,
  FORMS_BY_ORGANIZATION_INDEX,
} from '../constants';
import { InventoryForm, PredefinedForm } from '@equip-track/shared';

export class FormsAdapter {
  private readonly client = new DynamoDBClient({});
  private readonly docClient = DynamoDBDocumentClient.from(this.client);
  private readonly tableName = FORMS_TABLE_NAME;

  async getUserForms(userId: string): Promise<InventoryForm[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${USER_PREFIX}${userId}`,
      },
    });

    const result = await this.docClient.send(command);
    const items = result.Items ?? [];
    return items.map(this.getInventoryForm);
  }

  async getOrganizationForms(organizationId: string): Promise<InventoryForm[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: FORMS_BY_ORGANIZATION_INDEX,
      KeyConditionExpression: 'organizationId = :orgId',
      ExpressionAttributeValues: {
        ':orgId': `${ORG_PREFIX}${organizationId}`,
      },
    });

    const result = await this.docClient.send(command);
    const items = result.Items ?? [];
    return items
      .filter((item) => item.dbItemType === DbItemType.Form)
      .map(this.getInventoryForm);
  }

  async getPredefinedForms(organizationId: string): Promise<PredefinedForm[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${ORG_PREFIX}${organizationId}`,
      },
    });

    const result = await this.docClient.send(command);
    const items = result.Items ?? [];
    return items
      .filter((item) => item.dbItemType === DbItemType.PredefinedForm)
      .map(this.getPredefinedForm);
  }

  private getFormKey(userId: string, formId: string): DbKey {
    return {
      PK: `${USER_PREFIX}${userId}`,
      SK: `${FORM_PREFIX}${formId}`,
    };
  }

  private getPredefinedFormKey(organizationId: string, formId: string): DbKey {
    return {
      PK: `${ORG_PREFIX}${organizationId}`,
      SK: `${FORM_PREFIX}${formId}`,
    };
  }

  private getInventoryForm(item: any): InventoryForm {
    return {
      userID: item.userID,
      formID: item.formID,
      organizationID: item.organizationID,
      items: item.items,
      type: item.type,
      status: item.status,
      createdAtTimestamp: item.createdAtTimestamp,
      approvedAtTimestamp: item.approvedAtTimestamp,
      approvedByUserID: item.approvedByUserID,
      signatureURI: item.signatureURI,
      pdfURI: item.pdfURI,
      lastUpdated: item.lastUpdated,
    };
  }

  private getPredefinedForm(item: any): PredefinedForm {
    return {
      organizationID: item.organizationID,
      formID: item.formID,
      description: item.description,
      items: item.items,
    };
  }
}
