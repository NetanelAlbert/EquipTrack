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
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  USERS_AND_ORGANIZATIONS_TABLE_NAME,
  ORG_PREFIX,
  USER_PREFIX,
  METADATA_SK,
  ORGANIZATION_TO_USERS_INDEX,
  ORGANIZATION_TO_USERS_INDEX_PK,
  ORGANIZATION_TO_USERS_INDEX_SK,
} from '../constants';
import {
  Organization,
  User,
  UserAndUserInOrganization,
  UserInOrganization,
  UserState,
} from '@equip-track/shared';

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

  /**
   * Create a new user with UUID and external auth provider info
   */
  async createUser(user: User, googleSub?: string): Promise<void> {
    // First check if a user with this email already exists
    const existingUser = await this.getUserByEmail(user.email);
    if (existingUser) {
      throw new Error(`User with email ${user.email} already exists`);
    }

    const userDb: UserDb = {
      ...user,
      PK: `${USER_PREFIX}${user.id}`,
      SK: METADATA_SK,
      dbItemType: DbItemType.User,
      // Store Google sub for future reference if provided
      ...(googleSub && { googleSub }),
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: userDb,
    });

    await this.docClient.send(command);
  }

  /**
   * Update an existing user's state (e.g., from Invited to Active)
   */
  async updateUserState(userId: string, newState: UserState): Promise<void> {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK: `${USER_PREFIX}${userId}`,
        SK: METADATA_SK,
      },
      UpdateExpression: 'SET #state = :state',
      ExpressionAttributeNames: {
        '#state': 'state',
      },
      ExpressionAttributeValues: {
        ':state': newState,
      },
      // Ensure the user exists before updating
      ConditionExpression: 'attribute_exists(PK)',
    });

    try {
      await this.docClient.send(command);
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error(`User with ID ${userId} not found`);
      }
      throw error;
    }
  }

  /**
   * Update an existing user's name
   */
  async updateUserName(userId: string, newName: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK: `${USER_PREFIX}${userId}`,
        SK: METADATA_SK,
      },
      UpdateExpression: 'SET #name = :name',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':name': newName,
      },
      // Ensure the user exists before updating
      ConditionExpression: 'attribute_exists(PK)',
    });

    await this.docClient.send(command);
  }

  /**
   * Update an existing user's phone number
   */
  async updateUserPhone(userId: string, newPhone?: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK: `${USER_PREFIX}${userId}`,
        SK: METADATA_SK,
      },
      UpdateExpression: newPhone ? 'SET phone = :phone' : 'REMOVE phone',
      ...(newPhone && {
        ExpressionAttributeValues: {
          ':phone': newPhone,
        },
      }),
      // Ensure the user exists before updating
      ConditionExpression: 'attribute_exists(PK)',
    });

    await this.docClient.send(command);
  }

  /**
   * Get user by email address using the UsersByEmailIndex GSI
   */
  async getUserByEmail(
    email: string
  ): Promise<UserAndAllOrganizations | undefined> {
    // First, get the user record using the email GSI
    const userQuery = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'UsersByEmailIndex',
      KeyConditionExpression: 'email = :email AND SK = :sk',
      ExpressionAttributeValues: {
        ':email': email,
        ':sk': METADATA_SK,
      },
    });

    const userResult = await this.docClient.send(userQuery);
    const userItems = userResult.Items as UserDb[];

    if (!userItems || userItems.length === 0) {
      return undefined;
    }

    const userDb = userItems[0];
    const user = this.getUser(userDb);

    // Now get all user-organization relationships for this user
    const orgQuery = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :orgPrefix)',
      ExpressionAttributeValues: {
        ':pk': userDb.PK,
        ':orgPrefix': ORG_PREFIX,
      },
    });

    const orgResult = await this.docClient.send(orgQuery);
    const orgItems = (orgResult.Items as UserInOrganizationDb[]) ?? [];

    const userInOrganizations = orgItems.map(this.getUserInOrganizations);

    return { user, userInOrganizations };
  }

  /**
   * Get all users in an organization
   */
  async getUsersByOrganization(
    organizationId: string
  ): Promise<UserAndUserInOrganization[]> {
    // First, get all UserInOrganization records for this organization
    // Query using organizationId as GSI PK, GSI SK will be the main table's PK (USER#<userId>)
    const userOrgQuery = new QueryCommand({
      TableName: this.tableName,
      IndexName: ORGANIZATION_TO_USERS_INDEX,
      KeyConditionExpression: `${ORGANIZATION_TO_USERS_INDEX_PK} = :orgId AND begins_with(${ORGANIZATION_TO_USERS_INDEX_SK}, :userPrefix)`,
      ExpressionAttributeValues: {
        ':orgId': organizationId,
        ':userPrefix': USER_PREFIX,
      },
    });

    const userOrgResult = await this.docClient.send(userOrgQuery);
    const userOrgItems = (userOrgResult.Items as UserInOrganizationDb[]) ?? [];

    if (userOrgItems.length === 0) {
      return [];
    }

    // Extract user IDs
    const userIds = userOrgItems.map((item) => item.userId);

    // Batch get all user records
    const batchGetCommand = new BatchGetCommand({
      RequestItems: {
        [this.tableName]: {
          Keys: userIds.map((userId) => this.getUserKey(userId)),
        },
      },
    });

    const batchResult = await this.docClient.send(batchGetCommand);
    const userDbs = (batchResult.Responses?.[this.tableName] as UserDb[]) ?? [];

    const users = userDbs.map(this.getUser);
    const userInOrganizations = userOrgItems.map(this.getUserInOrganizations);

    return users.map((user) => ({
      user,
      userInOrganization: userInOrganizations.find(
        (uio) => uio.userId === user.id
      ),
    }));
  }

  /**
   * Create a new organization
   */
  async createOrganization(organization: Organization): Promise<void> {
    const organizationDb: OrganizationDb = {
      ...organization,
      PK: `${ORG_PREFIX}${organization.id}`,
      SK: METADATA_SK,
      dbItemType: DbItemType.Organization,
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: organizationDb,
    });

    await this.docClient.send(command);
  }

  /**
   * Create a user-organization relationship
   */
  async setUserInOrganization(
    userInOrganization: UserInOrganization
  ): Promise<void> {
    const userInOrganizationDb: UserInOrganizationDb = {
      ...userInOrganization,
      PK: `${USER_PREFIX}${userInOrganization.userId}`,
      SK: `${ORG_PREFIX}${userInOrganization.organizationId}`,
      dbItemType: DbItemType.UserInOrganization,
      // organizationId is included from userInOrganization for GSI PK
      // PK will be used as GSI SK automatically
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: userInOrganizationDb,
    });

    await this.docClient.send(command);
  }
}
