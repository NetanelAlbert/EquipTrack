import {
  InviteUser,
  BasicResponse,
  UserRole,
  UserState,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { badRequest } from '../../responses';
import { UsersAndOrganizationsAdapter } from '../../../db';
import { ORGANIZATION_ID_PATH_PARAM } from '@equip-track/shared';
import { v4 as uuidv4 } from 'uuid';

const usersAndOrganizationsAdapter = new UsersAndOrganizationsAdapter();

export const handler = async (
  req: InviteUser,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<BasicResponse> => {
  const organizationId = pathParams[ORGANIZATION_ID_PATH_PARAM];

  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  if (!req.email || !req.role) {
    throw badRequest('Email and role are required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(req.email)) {
    throw badRequest('Invalid email format');
  }

  // Validate role
  if (!Object.values(UserRole).includes(req.role)) {
    throw badRequest('Invalid user role');
  }

  try {
    // Check if user with this email already exists
    const existingUser = await usersAndOrganizationsAdapter.getUserByEmail(
      req.email
    );

    let userId: string;

    if (existingUser) {
      // User exists, check if they're already in this organization
      const existingOrgRelation = existingUser.userInOrganizations.find(
        (uo) => uo.organizationId === organizationId
      );

      if (existingOrgRelation) {
        console.log('User is already a member of this organization', existingOrgRelation);
        throw badRequest('User is already a member of this organization');
      }

      console.log('User exists, adding to organization', existingUser);

      userId = existingUser.user.id;
    } else {
      // Create new user in Invited state
      const newUser = {
        id: uuidv4(),
        name: req.email.split('@')[0], // Use email prefix as default name - user can update later
        email: req.email,
        state: UserState.Invited,
      };

      // Create the user
      await usersAndOrganizationsAdapter.createUser(newUser);
      userId = newUser.id;
    }
    // Create UserInOrganization relationship
    await usersAndOrganizationsAdapter.createUserInOrganization({
      userId,
      organizationId,
      role: req.role,
    });

    // TODO: Send email to user

    console.log(
      `User invited successfully: ${req.email} to organization ${organizationId} with role ${req.role}`
    );

    return {
      status: true,
    };
  } catch (error) {
    console.error('Error inviting user:', error);

    // Re-throw known errors
    if (
      error.message &&
      (error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('already'))
    ) {
      throw error;
    }

    // Generic error for unexpected issues
    throw new Error('Failed to invite user');
  }
};
