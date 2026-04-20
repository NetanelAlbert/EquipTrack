import { Auth, UserRole } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { UsersAndOrganizationsAdapter } from '../../db/tables/users-and-organizations.adapter';
import { JwtService } from '../../services/jwt.service';
import {
  badRequest,
  forbidden,
  internalServerError,
  isErrorResponse,
  unauthorized,
} from '../responses';
import { verifyPreviewPassword } from './preview-password-crypto';

function buildOrgIdToRole(
  userInOrganizations: Array<{ organizationId: string; role: UserRole }>
): Record<string, UserRole> {
  return userInOrganizations.reduce<Record<string, UserRole>>((acc, row) => {
    acc[row.organizationId] = row.role;
    return acc;
  }, {});
}

export const handler = async (
  req: Auth.FeaturePreviewPasswordRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature matches shared handler type
  _pathParams: APIGatewayProxyEventPathParameters
): Promise<Auth.FeaturePreviewPasswordResponse> => {
  try {
    if (process.env.FEATURE_PREVIEW_AUTH_ENABLED !== 'true') {
      throw forbidden('Feature preview authentication is disabled');
    }

    const email = typeof req?.email === 'string' ? req.email.trim() : '';
    const password = typeof req?.password === 'string' ? req.password : '';

    if (!email || !password) {
      throw badRequest('Email and password are required');
    }

    const adapter = new UsersAndOrganizationsAdapter();
    const row = await adapter.getUserByEmailForFeaturePreview(email);

    if (!row || !row.featurePreviewPasswordHash) {
      throw unauthorized('Invalid email or password');
    }

    if (!verifyPreviewPassword(password, row.featurePreviewPasswordHash)) {
      throw unauthorized('Invalid email or password');
    }

    const orgIdToRole = buildOrgIdToRole(row.userInOrganizations);
    if (Object.keys(orgIdToRole).length === 0) {
      throw unauthorized('Invalid email or password');
    }

    const jwtService = new JwtService();
    const jwt = await jwtService.generateToken(row.user.id, orgIdToRole);

    return {
      status: true,
      jwt,
    };
  } catch (error) {
    if (isErrorResponse(error)) {
      throw error;
    }

    throw internalServerError('Authentication failed');
  }
};
