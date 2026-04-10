import { Auth, UserRole, UserState } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  badRequest,
  forbidden,
  isErrorResponse,
  unauthorized,
} from '../responses';
import { JwtService } from '../../services/jwt.service';
import { UsersAndOrganizationsAdapter } from '../../db/tables/users-and-organizations.adapter';
import { verifyFeaturePreviewPassword } from './feature-preview-password-crypto';

function isFeaturePreviewStage(stage: string | undefined): boolean {
  return Boolean(stage && /^pr-\d+$/i.test(stage.trim()));
}

export const handler = async (
  req: Auth.FeaturePreviewPasswordAuthRequest,
  _pathParams: APIGatewayProxyEventPathParameters
): Promise<Auth.FeaturePreviewPasswordAuthResponse> => {
  void _pathParams;
  try {
    const stage = (process.env.STAGE || '').trim();
    if (!isFeaturePreviewStage(stage)) {
      throw forbidden('Feature preview authentication is not available');
    }

    const emailRaw = req?.email;
    const password = req?.password;
    if (
      typeof emailRaw !== 'string' ||
      typeof password !== 'string' ||
      !emailRaw.trim() ||
      !password
    ) {
      throw badRequest('Email and password are required');
    }

    const email = emailRaw.trim().toLowerCase();
    const usersAdapter = new UsersAndOrganizationsAdapter();
    const userBundle = await usersAdapter.getUserByEmail(email);

    if (!userBundle) {
      throw unauthorized('Invalid email or password');
    }

    if (userBundle.user.state === UserState.Disabled) {
      throw forbidden(
        'Your account has been disabled. Please contact your administrator.'
      );
    }

    const userRow = await usersAdapter.getUserDbRecord(userBundle.user.id);
    const storedHash = userRow?.featurePreviewPasswordHash;
    if (!storedHash) {
      throw unauthorized('Invalid email or password');
    }

    const ok = await verifyFeaturePreviewPassword(password, storedHash);
    if (!ok) {
      throw unauthorized('Invalid email or password');
    }

    const orgIdToRole = userBundle.userInOrganizations.reduce(
      (acc, org) => {
        acc[org.organizationId] = org.role;
        return acc;
      },
      {} as Record<string, UserRole>
    );

    const jwtService = new JwtService();
    const jwt = await jwtService.generateToken(
      userBundle.user.id,
      orgIdToRole
    );

    return {
      status: true,
      jwt,
    };
  } catch (error) {
    if (isErrorResponse(error)) {
      throw error;
    }
    console.error('[FEATURE_PREVIEW_PASSWORD_AUTH]', error);
    throw badRequest('Authentication failed');
  }
};
