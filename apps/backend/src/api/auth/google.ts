import { Auth } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { GoogleAuthService } from '../../services/google-auth.service';
import { badRequest } from '../responses';

// Get Google Client ID from environment variable
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '64930861221-3571tfrilm698f11h0p15ph8hi4klt1j.apps.googleusercontent.com';

export const handler = async (
  req: Auth.GoogleAuthRequest,
  _pathParams: APIGatewayProxyEventPathParameters
): Promise<Auth.GoogleAuthResponse> => {
  console.log('[GOOGLE_AUTH] Starting Google authentication handler');
  console.log('[GOOGLE_AUTH] Request received:', {
    hasIdToken: !!req?.idToken,
    idTokenLength: req?.idToken?.length || 0,
    pathParams: _pathParams,
  });

  try {
    // Validate request
    if (!req || !req.idToken) {
      console.log('[GOOGLE_AUTH] ERROR: Missing ID token in request');
      throw badRequest('Google ID token is required');
    }

    if (typeof req.idToken !== 'string' || req.idToken.trim().length === 0) {
      console.log('[GOOGLE_AUTH] ERROR: Invalid ID token format');
      throw badRequest('Invalid Google ID token format');
    }

    console.log(
      '[GOOGLE_AUTH] ID token validation passed, initializing Google Auth Service'
    );
    console.log('[GOOGLE_AUTH] Using Google Client ID:', GOOGLE_CLIENT_ID);

    // Initialize Google Auth Service
    const googleAuthService = new GoogleAuthService(GOOGLE_CLIENT_ID);

    console.log('[GOOGLE_AUTH] Calling Google Auth Service...');
    // Authenticate with Google
    const authResult = await googleAuthService.authenticateWithGoogle(
      req.idToken
    );

    console.log(
      '[GOOGLE_AUTH] Google authentication successful for user:',
      authResult.user?.email
    );
    console.log(
      '[GOOGLE_AUTH] User organizations count:',
      authResult.userInOrganizations?.length || 0
    );

    const response = {
      status: true,
      jwt: authResult.jwt,
      user: authResult.user,
      userInOrganizations: authResult.userInOrganizations,
    };

    console.log('[GOOGLE_AUTH] Returning successful response');
    return response;
  } catch (error) {
    console.error('[GOOGLE_AUTH] Google authentication handler error:', error);
    console.error('[GOOGLE_AUTH] Error stack:', error.stack);

    // Return user-friendly error messages
    if (error.message.includes('Invalid Google ID token')) {
      console.log('[GOOGLE_AUTH] Throwing: Invalid Google ID token');
      throw badRequest('The provided Google ID token is invalid');
    }
    if (error.message.includes('expired')) {
      console.log('[GOOGLE_AUTH] Throwing: Token expired');
      throw badRequest('The Google ID token has expired');
    }
    if (error.message.includes('Wrong issuer')) {
      console.log('[GOOGLE_AUTH] Throwing: Wrong issuer');
      throw badRequest('The Google ID token is from an unauthorized source');
    }
    if (error.message.includes('Email not verified')) {
      console.log('[GOOGLE_AUTH] Throwing: Email not verified');
      throw badRequest('Google account email must be verified');
    }

    // Generic error for unexpected issues
    console.log('[GOOGLE_AUTH] Throwing: Generic authentication error');
    throw badRequest('Google authentication failed. Please try again.');
  }
};
