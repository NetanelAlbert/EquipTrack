import {
  StartResponse,
  UserInOrganization,
  Organization,
} from '@equip-track/shared';
import { UsersAndOrganizationsAdapter } from '../db';
import { badRequest, resourceNotFound } from './responses';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';

const usersAndOrganizationsAdapter = new UsersAndOrganizationsAdapter();

export const handler = async (_req: unknown, pathParams: APIGatewayProxyEventPathParameters, userId?: string): Promise<StartResponse> => {
  if (!userId) {
    throw badRequest('User ID is required');
  }

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

  return { status: true, user, userInOrganizations, organizations };
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
