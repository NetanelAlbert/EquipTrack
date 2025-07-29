import {
  SetUser,
  BasicResponse,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { badRequest, internalServerError, ok, SuccessResponse } from '../../responses';
import { UsersAndOrganizationsAdapter } from '../../../db';

const usersAndOrganizationsAdapter = new UsersAndOrganizationsAdapter();

export const handler = async (
  req: SetUser,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<SuccessResponse> => {
  const organizationId = pathParams[ORGANIZATION_ID_PATH_PARAM];

  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  if (!req.userInOrganization) {
    throw badRequest('User information is required');
  }

  const { userInOrganization } = req;

  // Validate required fields
  if (!userInOrganization.userId) {
    throw badRequest('User ID is required');
  }

  if (!userInOrganization.organizationId) {
    throw badRequest('Organization ID is required');
  }

  if (userInOrganization.organizationId !== organizationId) {
    throw badRequest('Organization ID does not match');
  }

  try {
    console.log(
      `Updating user ${userInOrganization.userId} in organization ${organizationId}`,
      userInOrganization
    );

    await usersAndOrganizationsAdapter.setUserInOrganization(userInOrganization);

    console.log(`Successfully updated user ${userInOrganization.userId}`);

    return ok({
      status: true,
    });
  } catch (error) {
    console.error('Error updating user:', error);

    // If it's already an error response, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    // Re-throw known errors
    if (
      error.message &&
      (error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('not found'))
    ) {
      throw badRequest(error.message);
    }

    // Generic error for unexpected issues
    throw internalServerError('Failed to update user');
  }
};
