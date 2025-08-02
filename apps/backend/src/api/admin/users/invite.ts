import {
  InviteUser,
  UserRole,
  UserState,
  InviteUserResponse,
  User,
  UserInOrganization,
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
): Promise<InviteUserResponse> => {
  const organizationId = pathParams[ORGANIZATION_ID_PATH_PARAM];

  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  if (!req.email || !req.role) {
    throw badRequest('Email and role are required');
  }

  // Normalize email: trim whitespace and convert to lowercase
  const normalizedEmail = req.email.trim().toLowerCase();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw badRequest('Invalid email format');
  }

  // Validate role
  if (!Object.values(UserRole).includes(req.role)) {
    throw badRequest('Invalid user role');
  }

  try {
    // Check if user with this email already exists
    const existingUser = await usersAndOrganizationsAdapter.getUserByEmail(
      normalizedEmail
    );

    let user: User;

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

      user = existingUser.user;
    } else {
      // Create new user in Invited state
      const newUser: User = {
        id: uuidv4(),
        name: req.name || normalizedEmail.split('@')[0], // Use email prefix as default name - user can update later
        email: normalizedEmail,
        state: UserState.Invited,
      };

      // Create the user
      await usersAndOrganizationsAdapter.createUser(newUser);
      user = newUser;
    }
    // Create UserInOrganization relationship
    const userInOrganization: UserInOrganization = {
      userId: user.id,
      organizationId,
      role: req.role,
      department: req.department,
    };
    await usersAndOrganizationsAdapter.setUserInOrganization(userInOrganization);

    // TODO: Send email to user

    console.log(
      `User invited successfully: ${normalizedEmail} to organization ${organizationId} with role ${req.role}`
    );

    return {
      status: true,
      user,
      userInOrganization,
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
