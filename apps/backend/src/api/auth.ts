import {
  EndpointMeta,
  ORGANIZATION_ID_PATH_PARAM,
  USER_ID_PATH_PARAM,
  UserInOrganization,
  OptionalObject,
} from '@equip-track/shared';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { badRequest, forbidden, unauthorized } from './responses';
import { JwtService } from '../services/jwt.service';
import { JwtPayload } from '@equip-track/shared';

const jwtService = new JwtService();

export async function authenticateAndGetJwt<Req extends OptionalObject>(
  meta: EndpointMeta<Req, any>,
  event: APIGatewayProxyEvent,
  req?: Req
): Promise<JwtPayload> {
  console.log(`[AUTH] Authenticating endpoint: ${meta.path}`);
  console.log(`[AUTH] Required roles:`, meta.allowedRoles);

  const jwtPayload = await validateAndExtractJwt(event);
  console.log(`[AUTH] JWT validated for user:`, jwtPayload.sub);

  const organization = validateOrganizationAccess(jwtPayload, meta, event);
  console.log(`[AUTH] Organization access validated:`, organization);

  validateUserAccess<Req>(jwtPayload, meta, event, req, organization);
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
    const allowedRoles = meta.allowedRoles || [];
    if (!allowedRoles.includes(userRole)) {
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

function validateUserAccess<Req extends OptionalObject>(
  jwtPayload: JwtPayload,
  meta: EndpointMeta<any, any>,
  event: APIGatewayProxyEvent,
  req?: Req,
  organization?: UserInOrganization
) {
  let userId: string | undefined;
  if (meta.path.includes(`{${USER_ID_PATH_PARAM}}`)) {
    userId = event.pathParameters?.[USER_ID_PATH_PARAM];
    if (!userId) {
      throw badRequest('User ID is required');
    }
  } else if (req && 'userId' in req && typeof req.userId === 'string') {
    if (!req.userId) {
      throw badRequest('User ID cannot be empty');
    }
    userId = req.userId;
  } else if (req && 'userID' in req && typeof req.userID === 'string') {
    if (!req.userID) {
      throw badRequest('User ID cannot be empty');
    }
    userId = req.userID;
  }
  if (!userId) {
    return;
  }
  validateUserAccessByUserId(userId, meta, jwtPayload, organization);
}

function validateUserAccessByUserId(
  accessedUserId: string,
  meta: EndpointMeta<any, any>,
  jwtPayload: JwtPayload,
  organization?: UserInOrganization
) {
  if (organization && meta.allowedOtherUsers?.includes(organization.role)) {
    return;
  }
  if (accessedUserId === jwtPayload.sub) {
    return;
  }
  throw forbidden(`User ${organization?.userId} is not allowed to access other users`);
}
