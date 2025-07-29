import { Auth, JwtPayload } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { DynamicAuthService } from '../../services/dynamic-auth.service';
import { JwtService } from '../../services/jwt.service';
import { UserRole } from '@equip-track/shared';

const jwtService = new JwtService();
const dynamicAuthService = new DynamicAuthService();

export const handler = async (
  _req: undefined,
  _pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<Auth.RefreshTokenResponse> => {
  console.log('[REFRESH_TOKEN] Starting token refresh handler');

  try {
    // The JWT payload should be provided by the auth middleware
    if (!jwtPayload || !jwtPayload.sub) {
      throw new Error('User authentication required');
    }

    const userId = jwtPayload.sub;
    console.log(`[REFRESH_TOKEN] Refreshing token for user: ${userId}`);

    // Get current user organizations from database
    const currentOrganizations = await dynamicAuthService.getUserCurrentOrganizations(userId);
    
    // Build updated orgIdToRole mapping
    const orgIdToRole = currentOrganizations.reduce(
      (acc, org) => {
        acc[org.organizationId] = org.role;
        return acc;
      },
      {} as Record<string, UserRole>
    );

    console.log(`[REFRESH_TOKEN] User ${userId} current organizations:`, Object.keys(orgIdToRole));

    // Generate new JWT token with current permissions
    const newToken = await jwtService.generateToken(userId, orgIdToRole);

    console.log(`[REFRESH_TOKEN] New token generated for user ${userId}`);

    const response: Auth.RefreshTokenResponse = {
      status: true,
      jwt: newToken,
      organizationsCount: currentOrganizations.length,
      message: 'Token refreshed successfully'
    };

    return response;

  } catch (error) {
    console.error('[REFRESH_TOKEN] Token refresh handler error:', error);
    
    // If it's already a response object, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    // For any unexpected errors, return a generic error
    throw new Error('Token refresh failed. Please try again.');
  }
};