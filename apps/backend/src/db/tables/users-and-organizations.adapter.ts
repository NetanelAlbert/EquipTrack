/**
 * This adapter is used to access the UsersAndOrganizations table
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DbKey,
  OrganizationDb,
  UserDb,
  UserInOrganizationDb,
  DbItemType,
} from '../models';
import {
  DynamoDBDocumentClient,
  BatchGetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  USERS_AND_ORGANIZATIONS_TABLE_NAME,
  ORG_PREFIX,
  USER_PREFIX,
  METADATA_SK,
} from '../constants';
import { Organization, User, UserInOrganization } from '@equip-track/shared';

export interface UserAndAllOrganizations {
  user: User;
  userInOrganizations: UserInOrganization[];
}

export class UsersAndOrganizationsAdapter {
  private readonly client = new DynamoDBClient({});
  private readonly docClient = DynamoDBDocumentClient.from(this.client);
  private readonly tableName = USERS_AND_ORGANIZATIONS_TABLE_NAME;

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
    items.forEach((item) => {
      if (item.dbItemType === DbItemType.User) {
        user = this.getUser(item as UserDb);
      } else if (item.dbItemType === DbItemType.UserInOrganization) {
        userInOrganizations.push(
          this.getUserInOrganizations(item as UserInOrganizationDb)
        );
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
    const organizationsDB =
      (result.Responses?.[this.tableName] as Array<OrganizationDb>) ?? [];
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

  private getUser(userDB: UserDb): User {
    return {
      id: userDB.id,
      name: userDB.name,
      email: userDB.email,
      phone: userDB.phone,
      state: userDB.state,
    };
  }

  private getUserInOrganizations(
    userInOrganizationsDB: UserInOrganizationDb
  ): UserInOrganization {
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
