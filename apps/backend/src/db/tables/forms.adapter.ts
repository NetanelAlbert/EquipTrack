/**
 * This adapter is used to access the Forms table
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DbKey, DbItemType } from '../models';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  GetCommand,
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

  async getUserForms(
    userId: string,
    organizationId: string
  ): Promise<InventoryForm[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${ORG_PREFIX}${organizationId}#${USER_PREFIX}${userId}`,
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

  async getForm(
    userId: string,
    organizationId: string,
    formId: string
  ): Promise<InventoryForm> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: this.getFormKey(userId, organizationId, formId),
    });

    const result = await this.docClient.send(command);
    if (!result.Item) {
      throw new Error(`Form with ID ${formId} for user ${userId} not found`);
    }

    return this.getInventoryForm(result.Item);
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

  async createForm(form: InventoryForm): Promise<void> {
    const formDb = {
      ...this.getFormKey(form.userID, form.organizationID, form.formID),
      dbItemType: DbItemType.Form,
      organizationId: `${ORG_PREFIX}${form.organizationID}`,
      ...form,
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: formDb,
    });

    await this.docClient.send(command);
  }

  async updateForm(
    formID: string,
    userId: string,
    organizationId: string,
    updates: Partial<InventoryForm>
  ): Promise<InventoryForm> {
    const key = this.getFormKey(userId, organizationId, formID);

    // Build dynamic update expression
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    // Map of field names that might need attribute name aliases
    const fieldMappings: Record<string, string> = {
      status: '#status',
      lastUpdated: '#lastUpdated',
    };

    for (const [field, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const attributeName = fieldMappings[field] || field;
        const attributeValue = `:${field}`;

        updateExpressions.push(`${attributeName} = ${attributeValue}`);
        expressionAttributeValues[attributeValue] = value;

        if (fieldMappings[field]) {
          expressionAttributeNames[attributeName] = field;
        }
      }
    }

    if (updateExpressions.length === 0) {
      return; // Nothing to update
    }

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ...(Object.keys(expressionAttributeNames).length > 0 && {
        ExpressionAttributeNames: expressionAttributeNames,
      }),
      // Ensure the form exists before updating
      ConditionExpression: 'attribute_exists(PK)',
      // Return all attributes after the update
      ReturnValues: 'ALL_NEW',
    });

    try {
      const result = await this.docClient.send(command);
      if (!result.Attributes) {
        throw new Error(`Form with ID ${formID} for user ${userId} not found`);
      }
      return this.getInventoryForm(result.Attributes);
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error(`Form with ID ${formID} for user ${userId} not found`);
      }
      throw error;
    }
  }

  private getFormKey(
    userId: string,
    organizationId: string,
    formId: string
  ): DbKey {
    return {
      PK: `${ORG_PREFIX}${organizationId}#${USER_PREFIX}${userId}`,
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
      approvedByUserId: item.approvedByUserId,
      pdfUri: item.pdfUri,
      rejectionReason: item.rejectionReason,
      lastUpdated: item.lastUpdated,
      createdByUserId: item.createdByUserId,
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
