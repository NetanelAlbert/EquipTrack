import {
  EndpointMeta,
  ORGANIZATION_ID_PATH_PARAM,
  USER_ID_PATH_PARAM,
  UserInOrganization,
  UserRole,
} from '@equip-track/shared';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { badRequest, forbidden, unauthorized } from './responses';
import { JwtService } from '../services/jwt.service';
import { DynamicAuthService } from '../services/dynamic-auth.service';
import { JwtPayload } from '@equip-track/shared';

const jwtService = new JwtService();
const dynamicAuthService = new DynamicAuthService();
const rolesAllowedToAccessOtherUsers = [UserRole.Admin];

export async function authenticateAndGetJwt(
  meta: EndpointMeta<any, any>,
  event: APIGatewayProxyEvent
): Promise<JwtPayload> {
  console.log(`[AUTH] Authenticating endpoint: ${meta.path}`);
  console.log(`[AUTH] Required roles:`, meta.allowedRoles);

  const jwtPayload = await validateAndExtractJwt(event);
  console.log(`[AUTH] JWT validated for user:`, jwtPayload.sub);

  const organization = await validateOrganizationAccess(jwtPayload, meta, event);
  console.log(`[AUTH] Organization access validated:`, organization);

  validateUserAccess(jwtPayload, meta, event, organization);
  console.log(`[AUTH] User access validated successfully`);

  return jwtPayload;
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

async function validateOrganizationAccess(
  jwtPayload: JwtPayload,
  meta: EndpointMeta<any, any>,
  event: APIGatewayProxyEvent
): Promise<UserInOrganization | undefined> {
  if (meta.path.includes(`{${ORGANIZATION_ID_PATH_PARAM}}`)) {
    const organizationId = event.pathParameters?.[ORGANIZATION_ID_PATH_PARAM];
    if (!organizationId) {
      throw badRequest('Organization ID is required');
    }

    // Validate current user permissions against database for organization-specific endpoints
    // This ensures that recent permission changes (add/remove/role change) are enforced immediately
    const currentUserRole = await dynamicAuthService.validateUserOrganizationPermission(
      jwtPayload.sub,
      organizationId
    );

    if (!currentUserRole) {
      console.log(`[AUTH] User ${jwtPayload.sub} denied access to organization ${organizationId} - not a current member`);
      throw forbidden('User is not a member of the organization');
    }

    // Check if user's current role is allowed for this endpoint
    const allowedRoles = meta.allowedRoles || [];
    if (!allowedRoles.includes(currentUserRole)) {
      console.log(`[AUTH] User ${jwtPayload.sub} denied access - role ${currentUserRole} not in allowed roles: ${allowedRoles.join(', ')}`);
      throw forbidden(
        `User Role ${currentUserRole} is not allowed to access this endpoint`
      );
    }

    console.log(`[AUTH] User ${jwtPayload.sub} granted access to organization ${organizationId} with role ${currentUserRole}`);

    // Return organization info with current role from database
    return {
      userId: jwtPayload.sub,
      organizationId: organizationId,
      role: currentUserRole,
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
  if (meta.path.includes(`{${USER_ID_PATH_PARAM}}`)) {
    const userId = event.pathParameters?.[USER_ID_PATH_PARAM];
    if (!userId) {
      throw badRequest('User ID is required');
    }
    if (rolesAllowedToAccessOtherUsers.includes(organization.role)) {
      return;
    }
    if (userId === jwtPayload.sub) {
      return;
    }
    throw forbidden(
      `User ${organization.userId} is not allowed to access other users`
    );
  }
}
