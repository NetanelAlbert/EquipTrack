import {
  EndpointMeta,
  ORGANIZATION_ID_PATH_PARAM,
  USER_ID_PATH_PARAM,
  UserInOrganization,
  UserRole,
} from '@equip-track/shared';
import { UserAndAllOrganizations, UsersAndOrganizationsAdapter } from '../db';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { badRequest, forbidden, unauthorized } from './responses';

const usersAndOrganizationsAdapter = new UsersAndOrganizationsAdapter();
const rolesAllowedToAccessOtherUsers = [UserRole.Admin];

export async function authenticate(
  meta: EndpointMeta<any, any>,
  event: APIGatewayProxyEvent
): Promise<boolean> {
  const userId = getUserId(event);
  const { user, userInOrganizations } = await getUser(userId);
  if (!user) {
    throw unauthorized('User not found');
  }
  if (!userInOrganizations) {
    throw unauthorized('User not found in any organization');
  }
  const organization = validateOrganizationAccess(
    userInOrganizations,
    meta,
    event
  );
  validateUserAccess(userInOrganizations, meta, event, organization);
  return true;
}

function getUserId(event: APIGatewayProxyEvent) {
  // return event.requestContext.authorizer.claims.sub;
  // TODO: Implement real authentication
  return 'dummy';
}

async function getUser(userId: string): Promise<UserAndAllOrganizations> {
  try {
    return await usersAndOrganizationsAdapter.getUserAndAllOrganizations(
      userId
    );
  } catch (error) {
    console.error(`Error getting user ${userId}`, error);
    throw unauthorized('User not found');
  }
}

function validateOrganizationAccess(
  userInOrganizations: UserInOrganization[],
  meta: EndpointMeta<any, any>,
  event: APIGatewayProxyEvent
): UserInOrganization | undefined {
  if (meta.path.includes(`{${ORGANIZATION_ID_PATH_PARAM}}`)) {
    const organizationId = event.pathParameters?.[ORGANIZATION_ID_PATH_PARAM];
    if (!organizationId) {
      throw badRequest('Organization ID is required');
    }
    const organization = userInOrganizations.find(
      (org) => org.organizationId === organizationId
    );
    if (!organization) {
      throw forbidden('User is not a member of the organization');
    }
    if (!meta.allowedRoles.includes(organization.role)) {
      throw forbidden(
        `User Role ${organization.role} is not allowed to access this endpoint`
      );
    }
    return organization;
  }
  return undefined;
}

function validateUserAccess(
  userInOrganizations: UserInOrganization[],
  meta: EndpointMeta<any, any>,
  event: APIGatewayProxyEvent,
  organization?: UserInOrganization
) {
  if (!organization) {
    throw forbidden('Global access is not allowed');
  }
  if (meta.path.includes(`{${USER_ID_PATH_PARAM}}`)) {
    const userId = event.pathParameters?.[USER_ID_PATH_PARAM];
    if (!userId) {
      throw badRequest('User ID is required');
    }
    if (rolesAllowedToAccessOtherUsers.includes(organization.role)) {
      return;
    }
    if (userId === organization.userId) {
      return;
    }
    throw forbidden(
      `User ${organization.userId} is not allowed to access other users`
    );
  }
}
