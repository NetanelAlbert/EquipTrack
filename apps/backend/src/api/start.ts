import {
  StartResponse,
  UserInOrganization,
  Organization,
  JwtPayload,
  UserRole,
} from '@equip-track/shared';
import { UsersAndOrganizationsAdapter } from '../db';
import { JwtService } from '../services/jwt.service';
import { badRequest, resourceNotFound } from './responses';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';

const usersAndOrganizationsAdapter = new UsersAndOrganizationsAdapter();
const jwtService = new JwtService();

export const handler = async (
  _req: unknown,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<StartResponse> => {
  if (!jwtPayload) {
    throw badRequest('User ID is required');
  }

  const userId = jwtPayload.sub;

  const userAndAllOrganizations =
    await usersAndOrganizationsAdapter.getUserAndAllOrganizations(userId);
  if (!userAndAllOrganizations) {
    throw resourceNotFound('User not found');
  }
  const { user, userInOrganizations } = userAndAllOrganizations;
  const organizations: Organization[] = await getOrganizations(
    userInOrganizations
  );
  validateUserInOrganizations(userInOrganizations, organizations);

  let refreshedToken: string | undefined;
  const dbOrgIdToRole = buildOrgIdToRole(userInOrganizations);
  if (hasPermissionsChanged(jwtPayload.orgIdToRole, dbOrgIdToRole)) {
    refreshedToken = await jwtService.generateToken(userId, dbOrgIdToRole);
  }

  return { status: true, user, userInOrganizations, organizations, refreshedToken };
};

async function getOrganizations(
  userInOrganizations: UserInOrganization[]
): Promise<Organization[]> {
  const organizationIds: string[] = userInOrganizations.map(
    (u) => u.organizationId
  );
  return await usersAndOrganizationsAdapter.getOrganizations(organizationIds);
}

function validateUserInOrganizations(
  userInOrganizations: UserInOrganization[],
  organizations: Organization[]
) {
  userInOrganizations.forEach((u) => {
    if (!organizations.some((o) => o.id === u.organizationId)) {
      throw resourceNotFound(
        `Organization not found (organizationId: ${u.organizationId})`
      );
    }
  });
}

export function buildOrgIdToRole(
  userInOrganizations: UserInOrganization[]
): Record<string, UserRole> {
  return userInOrganizations.reduce(
    (acc, org) => {
      acc[org.organizationId] = org.role;
      return acc;
    },
    {} as Record<string, UserRole>
  );
}

export function hasPermissionsChanged(
  jwtOrgIdToRole: Record<string, UserRole>,
  dbOrgIdToRole: Record<string, UserRole>
): boolean {
  const jwtKeys = Object.keys(jwtOrgIdToRole).sort();
  const dbKeys = Object.keys(dbOrgIdToRole).sort();
  if (jwtKeys.length !== dbKeys.length) return true;
  for (let i = 0; i < jwtKeys.length; i++) {
    if (jwtKeys[i] !== dbKeys[i]) return true;
    if (jwtOrgIdToRole[jwtKeys[i]] !== dbOrgIdToRole[dbKeys[i]]) return true;
  }
  return false;
}
