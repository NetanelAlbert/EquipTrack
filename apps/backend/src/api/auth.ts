import {
  EndpointMeta,
  ORGANIZATION_ID_PATH_PARAM,
  USER_ID_PATH_PARAM,
  UserInOrganization,
  UserRole,
} from '@equip-track/shared';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { badRequest, forbidden, unauthorized } from './responses';
import { JwtService, JwtPayload } from '../services/jwt.service';

const jwtService = new JwtService();
const rolesAllowedToAccessOtherUsers = [UserRole.Admin];

export async function authenticate(
  meta: EndpointMeta<any, any>,
  event: APIGatewayProxyEvent
): Promise<boolean> {
  const jwtPayload = await validateAndExtractJwt(event);
  const organization = validateOrganizationAccess(jwtPayload, meta, event);
  validateUserAccess(jwtPayload, meta, event, organization);
  return true;
}

/**
 * Extract and validate JWT token from Authorization header
 * Returns the JWT payload if the token is valid, throws an error if not
 */
async function validateAndExtractJwt(
  event: APIGatewayProxyEvent
): Promise<JwtPayload> {
  try {
    // Extract Authorization header
    const authHeader =
      event.headers?.['Authorization'] || event.headers?.['authorization'];

    if (!authHeader) {
      throw unauthorized('Authorization header is required');
    }

    // Extract Bearer token
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!bearerMatch) {
      throw unauthorized(
        'Authorization header must be in format: Bearer <token>'
      );
    }

    const token = bearerMatch[1];

    // Validate JWT token and return payload
    const payload = await jwtService.validateToken(token);

    if (!payload.sub) {
      throw unauthorized('Invalid token: user ID not found');
    }

    return payload;
  } catch (error) {
    // If it's already an unauthorized error, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    // Handle JWT validation errors
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        throw unauthorized('Authentication token has expired');
      }
      if (error.message.includes('Invalid')) {
        throw unauthorized('Invalid authentication token');
      }
    }

    console.error('JWT validation error:', error);
    throw unauthorized('Authentication failed');
  }
}

function validateOrganizationAccess(
  jwtPayload: JwtPayload,
  meta: EndpointMeta<any, any>,
  event: APIGatewayProxyEvent
): UserInOrganization | undefined {
  if (meta.path.includes(`{${ORGANIZATION_ID_PATH_PARAM}}`)) {
    const organizationId = event.pathParameters?.[ORGANIZATION_ID_PATH_PARAM];
    if (!organizationId) {
      throw badRequest('Organization ID is required');
    }

    // Check if user has access to this organization from JWT payload
    const userRole = jwtPayload.orgIdToRole[organizationId];
    if (!userRole) {
      throw forbidden('User is not a member of the organization');
    }

    // Check if user's role is allowed for this endpoint
    if (!meta.allowedRoles.includes(userRole)) {
      throw forbidden(
        `User Role ${userRole} is not allowed to access this endpoint`
      );
    }

    // Return organization info constructed from JWT payload
    return {
      userId: jwtPayload.sub,
      organizationId: organizationId,
      role: userRole,
    };
  }
  return undefined;
}

function validateUserAccess(
  jwtPayload: JwtPayload,
  meta: EndpointMeta<any, any>,
  event: APIGatewayProxyEvent,
  organization?: UserInOrganization
) {
  if (!organization) {
    throw forbidden('Global access is not allowed');
  }
  if (meta.path.includes(`{${USER_ID_PATH_PARAM}}`)) {
    const userId = event.pathParameters?.[USER_ID_PATH_PARAM];
    if (!userId) {
      throw badRequest('User ID is required');
    }
    if (rolesAllowedToAccessOtherUsers.includes(organization.role)) {
      return;
    }
    if (userId === organization.userId) {
      return;
    }
    throw forbidden(
      `User ${organization.userId} is not allowed to access other users`
    );
  }
}
