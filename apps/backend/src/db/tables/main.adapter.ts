/**
 * This adapter is used to access the main table EquipTrack
 * */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DbKey,
  OrganizationDb,
  UserDb,
  UserInOrganizationDb,
  DbItemType,
} from '../models';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  MAIN_TABLE_NAME,
  ORG_PREFIX,
  USER_PREFIX,
  METADATA_SK,
  PRODUCT_PREFIX,
  UPI_PREFIX,
} from '../constants';
import { Organization, User, UserInOrganization } from '@equip-track/shared';

export interface UserAndAllOrganizations {
    user: User;
    userInOrganizations: UserInOrganization[];
  }

export class MainAdapter {
  private readonly client = new DynamoDBClient({});
  private readonly docClient = DynamoDBDocumentClient.from(this.client);
  private readonly tableName = MAIN_TABLE_NAME;

  async getUserAndAllOrganizations(
    userId: string
  ): Promise<UserAndAllOrganizations | undefined> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${USER_PREFIX}${userId}`,
      },
    });

    const result = await this.docClient.send(command);
    const items = (result.Items as Array<UserDb | UserInOrganizationDb>) ?? [];
    let user: User | undefined;
    const userInOrganizations: UserInOrganization[] = [];
    items.forEach(item => {
      if (item.dbItemType === DbItemType.User) {
        user = this.getUser(item as UserDb);
      } else if (item.dbItemType === DbItemType.UserInOrganization) {
        userInOrganizations.push(this.getUserInOrganizations(item as UserInOrganizationDb));
      }
    });
    if (!user) {
      return undefined;
    }
    return { user, userInOrganizations };
  }

  async getOrganizations(
    organizationIds: string[]
  ): Promise<Array<Organization>> {
    const command = new BatchGetCommand({
      RequestItems: {
        [this.tableName]: {
          Keys: organizationIds.map(this.getOrganizationKey),
        },
      },
    });

    const result = await this.docClient.send(command);
    const organizationsDB = (result.Responses?.[this.tableName] as Array<OrganizationDb>) ?? [];
    return organizationsDB.map(this.getOrganization);
  }

  private getOrganizationKey(organizationId: string): DbKey {
    return {
      PK: `${ORG_PREFIX}${organizationId}`,
      SK: METADATA_SK,
    };
  }

  private getUserKey(userId: string): DbKey {
    return {
      PK: `${USER_PREFIX}${userId}`,
      SK: METADATA_SK,
    };
  }

  private getUserInOrganizationKey(
    userId: string,
    organizationId: string
  ): DbKey {
    return {
      PK: `${USER_PREFIX}${userId}`,
      SK: `${ORG_PREFIX}${organizationId}`,
    };
  }

  private getProductKey(productId: string, organizationId: string): DbKey {
    return {
      PK: `${ORG_PREFIX}${organizationId}`,
      SK: `${PRODUCT_PREFIX}${productId}`,
    };
  }

  private getUniqueProductKey(
    productId: string,
    upi: string,
    organizationId: string
  ): DbKey {
    return {
      PK: `${ORG_PREFIX}${organizationId}`,
      SK: `${PRODUCT_PREFIX}${productId}#${UPI_PREFIX}#${upi}`,
    };
  }

  private async getItem(
    key: DbKey
  ): Promise<Record<string, unknown> | undefined> {
    const command = new GetCommand({
      TableName: MAIN_TABLE_NAME,
      Key: key,
    });

    const result = await this.docClient.send(command);
    return result.Item;
  }

  private async putItem(item: Record<string, unknown>): Promise<void> {
    const command = new PutCommand({
      TableName: MAIN_TABLE_NAME,
      Item: item,
    });

    await this.docClient.send(command);
  }

  private async deleteItem(key: DbKey): Promise<void> {
    const command = new DeleteCommand({
      TableName: MAIN_TABLE_NAME,
      Key: key,
    });

    await this.docClient.send(command);
  }

  private async updateItem(
    key: DbKey,
    updates: Record<string, unknown>
  ): Promise<void> {
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

    const command = new UpdateCommand({
      TableName: MAIN_TABLE_NAME,
      Key: key,
      UpdateExpression: `set ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await this.docClient.send(command);
  }

  private getUser(userDB: UserDb): User {
      return {
      id: userDB.id,
      name: userDB.name,
      email: userDB.email,
      phone: userDB.phone,
      state: userDB.state,
    };
  }
  
  private getUserInOrganizations(userInOrganizationsDB: UserInOrganizationDb): UserInOrganization {
    return {
      organizationId: userInOrganizationsDB.organizationId,
      userId: userInOrganizationsDB.userId,
      role: userInOrganizationsDB.role, 
      department: userInOrganizationsDB.department,
      departmentRole: userInOrganizationsDB.departmentRole,
    };
  }

  private getOrganization(organizationDB: OrganizationDb): Organization {
    return {
      id: organizationDB.id,
      name: organizationDB.name,
      imageUrl: organizationDB.imageUrl,
    };
  }
}
