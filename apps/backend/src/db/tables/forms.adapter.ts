/**
 * This adapter is used to access the Forms table
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DbItemType } from '../models';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { FORMS_TABLE_NAME } from '../constants';
import { InventoryForm, PredefinedForm } from '@equip-track/shared';
import { getDynamoDbClientConfig } from '../../services/aws-client-config.service';

/** Sort key for user inventory forms: `<userId>#<formId>` */
const userFormSortKey = (userId: string, formId: string): string =>
  `${userId}#${formId}`;

export class FormsAdapter {
  private readonly client = new DynamoDBClient(getDynamoDbClientConfig());
  private readonly docClient = DynamoDBDocumentClient.from(this.client);
  private readonly tableName = FORMS_TABLE_NAME;

  async getUserForms(
    userId: string,
    organizationId: string
  ): Promise<InventoryForm[]> {
    console.log('[FormsAdapter.getUserForms]', { userId, organizationId });
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression:
        'organizationId = :org AND begins_with(userFormKey, :userPrefix)',
      ExpressionAttributeValues: {
        ':org': organizationId,
        ':userPrefix': `${userId}#`,
      },
    });

    const result = await this.docClient.send(command);
    const items = result.Items ?? [];
    return items
      .filter((item) => item.dbItemType === DbItemType.Form)
      .map((item) => this.getInventoryForm(item));
  }

  async getOrganizationForms(organizationId: string): Promise<InventoryForm[]> {
    console.log('[FormsAdapter.getOrganizationForms]', { organizationId });
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'organizationId = :org',
      ExpressionAttributeValues: {
        ':org': organizationId,
      },
    });

    const result = await this.docClient.send(command);
    const items = result.Items ?? [];
    return items
      .filter(
        (item) =>
          item.dbItemType === DbItemType.Form &&
          typeof item['userFormKey'] === 'string' &&
          !(item['userFormKey'] as string).startsWith('PREDEFINED#')
      )
      .map((item) => this.getInventoryForm(item));
  }

  async getForm(
    userId: string,
    organizationId: string,
    formId: string
  ): Promise<InventoryForm> {
    console.log('[FormsAdapter.getForm]', {
      userId,
      organizationId,
      formId,
    });
    const command = new GetCommand({
      TableName: this.tableName,
      Key: this.getUserFormKey(userId, organizationId, formId),
    });

    const result = await this.docClient.send(command);
    if (!result.Item) {
      throw new Error(`Form with ID ${formId} for user ${userId} not found`);
    }

    return this.getInventoryForm(result.Item);
  }

  async getPredefinedForms(organizationId: string): Promise<PredefinedForm[]> {
    console.log('[FormsAdapter.getPredefinedForms]', { organizationId });
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression:
        'organizationId = :org AND begins_with(userFormKey, :pre)',
      ExpressionAttributeValues: {
        ':org': organizationId,
        ':pre': 'PREDEFINED#',
      },
    });

    const result = await this.docClient.send(command);
    const items = result.Items ?? [];
    return items
      .filter((item) => item.dbItemType === DbItemType.PredefinedForm)
      .map((item) => this.getPredefinedForm(item));
  }

  async createForm(form: InventoryForm): Promise<void> {
    console.log('[FormsAdapter.createForm]', {
      formId: form.formID,
      userId: form.userID,
      organizationId: form.organizationId,
    });
    const formDb = {
      ...this.getUserFormKey(form.userID, form.organizationId, form.formID),
      dbItemType: DbItemType.Form,
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
    console.log('[FormsAdapter.updateForm]', {
      formID,
      userId,
      organizationId,
    });
    const key = this.getUserFormKey(userId, organizationId, formID);

    // Build dynamic update expression
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = {};
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
      ConditionExpression: 'attribute_exists(organizationId)',
      // Return all attributes after the update
      ReturnValues: 'ALL_NEW',
    });

    try {
      const result = await this.docClient.send(command);
      if (!result.Attributes) {
        throw new Error(`Form with ID ${formID} for user ${userId} not found`);
      }
      return this.getInventoryForm(result.Attributes);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        (error as { name: string }).name === 'ConditionalCheckFailedException'
      ) {
        throw new Error(`Form with ID ${formID} for user ${userId} not found`);
      }
      throw error;
    }
  }

  private getUserFormKey(
    userId: string,
    organizationId: string,
    formId: string
  ): { organizationId: string; userFormKey: string } {
    return {
      organizationId,
      userFormKey: userFormSortKey(userId, formId),
    };
  }

  private getInventoryForm(item: Record<string, unknown>): InventoryForm {
    if (item['dbItemType'] !== DbItemType.Form) {
      throw new Error(`Item is not a form: ${JSON.stringify(item)}`);
    }

    const { dbItemType, userFormKey, ...rest } = item;
    void dbItemType;
    void userFormKey;
    return rest as unknown as InventoryForm;
  }

  private getPredefinedForm(item: Record<string, unknown>): PredefinedForm {
    if (item['dbItemType'] !== DbItemType.PredefinedForm) {
      throw new Error(`Item is not a predefined form: ${JSON.stringify(item)}`);
    }

    const { dbItemType, userFormKey, ...rest } = item;
    void dbItemType;
    void userFormKey;
    return rest as unknown as PredefinedForm;
  }
}
