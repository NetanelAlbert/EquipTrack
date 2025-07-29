import {
  GetUsersResponse,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { badRequest, ok, internalServerError, SuccessResponse } from '../../responses';
import { UsersAndOrganizationsAdapter } from '../../../db';

const usersAndOrganizationsAdapter = new UsersAndOrganizationsAdapter();

export const handler = async (
  _req: undefined,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<SuccessResponse> => {
  const organizationId = pathParams[ORGANIZATION_ID_PATH_PARAM];

  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  try {
    console.log(`Getting users for organization: ${organizationId}`);

    const users = await usersAndOrganizationsAdapter.getUsersByOrganization(
      organizationId
    );

    console.log(
      `Found ${users.length} users in organization ${organizationId}`
    );

    return ok({
      status: true,
      users,
    });
  } catch (error) {
    console.error('Error getting users:', error);
    throw internalServerError('Failed to get users');
  }
};
