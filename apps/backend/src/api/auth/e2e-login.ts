import { Auth, UserRole } from '@equip-track/shared';
import { APIGatewayProxyEvent, APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  badRequest,
  forbidden,
  internalServerError,
  unauthorized,
} from '../responses';
import { JwtService } from '../../services/jwt.service';

const validRoles = new Set(Object.values(UserRole));

function getHeaderValue(
  event: APIGatewayProxyEvent | undefined,
  headerName: string
): string | undefined {
  if (!event?.headers) {
    return undefined;
  }

  const exact = event.headers[headerName];
  if (exact) {
    return exact;
  }

  const lowerHeaderName = headerName.toLowerCase();
  const matchingHeader = Object.entries(event.headers).find(
    ([key]) => key.toLowerCase() === lowerHeaderName
  );

  return matchingHeader?.[1];
}

export const handler = async (
  req: Auth.E2eAuthRequest,
  _pathParams: APIGatewayProxyEventPathParameters,
  _jwtPayload: undefined,
  event?: APIGatewayProxyEvent
): Promise<Auth.E2eAuthResponse> => {
  try {
    if (process.env.E2E_AUTH_ENABLED !== 'true') {
      throw forbidden('E2E authentication is disabled');
    }

    const expectedSecret = process.env.E2E_AUTH_SECRET;
    if (!expectedSecret) {
      throw internalServerError('E2E auth secret is not configured');
    }

    const providedSecret = getHeaderValue(event, 'x-e2e-secret');
    if (!providedSecret || providedSecret !== expectedSecret) {
      throw unauthorized('Invalid E2E auth secret');
    }

    if (!req?.userId) {
      throw badRequest('userId is required');
    }

    if (!req.orgIdToRole || typeof req.orgIdToRole !== 'object') {
      throw badRequest('orgIdToRole is required');
    }

    const invalidRole = Object.values(req.orgIdToRole).find(
      (role) => !validRoles.has(role as UserRole)
    );
    if (invalidRole) {
      throw badRequest(`Invalid role provided: ${invalidRole}`);
    }

    const jwtService = new JwtService();
    const jwt = await jwtService.generateToken(req.userId, req.orgIdToRole);

    return {
      status: true,
      jwt,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    throw internalServerError('Failed to generate E2E auth token');
  }
};
