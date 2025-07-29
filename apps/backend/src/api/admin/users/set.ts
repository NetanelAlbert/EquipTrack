import {
  SetUser,
  BasicResponse,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { badRequest } from '../../responses';
import { UsersAndOrganizationsAdapter } from '../../../db';
import { DynamicAuthService } from '../../../services/dynamic-auth.service';

const usersAndOrganizationsAdapter = new UsersAndOrganizationsAdapter();
const dynamicAuthService = new DynamicAuthService();

export const handler = async (
  req: SetUser,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<BasicResponse> => {
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

    // Invalidate permission cache for the user since their permissions may have changed
    dynamicAuthService.invalidateUserCache(userInOrganization.userId);
    console.log(`Cache invalidated for user ${userInOrganization.userId} due to permission change`);

    console.log(`Successfully updated user ${userInOrganization.userId}`);

    return {
      status: true,
    };
  } catch (error) {
    console.error('Error updating user:', error);

    // Re-throw known errors
    if (
      error.message &&
      (error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('not found'))
    ) {
      throw error;
    }

    // Generic error for unexpected issues
    throw new Error('Failed to update user');
  }
};
