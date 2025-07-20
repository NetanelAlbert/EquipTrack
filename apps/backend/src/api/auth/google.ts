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
  try {
    // Validate request
    if (!req || !req.idToken) {
      throw badRequest('Google ID token is required');
    }

    if (typeof req.idToken !== 'string' || req.idToken.trim().length === 0) {
      throw badRequest('Invalid Google ID token format');
    }

    // Initialize Google Auth Service
    const googleAuthService = new GoogleAuthService(GOOGLE_CLIENT_ID);

    // Authenticate with Google
    const authResult = await googleAuthService.authenticateWithGoogle(
      req.idToken
    );

    return {
      status: true,
      jwt: authResult.jwt,
      user: authResult.user,
      userInOrganizations: authResult.userInOrganizations,
    };
  } catch (error) {
    console.error('Google authentication handler error:', error);

    // Return user-friendly error messages
    if (error.message.includes('Invalid Google ID token')) {
      throw badRequest('The provided Google ID token is invalid');
    }
    if (error.message.includes('expired')) {
      throw badRequest('The Google ID token has expired');
    }
    if (error.message.includes('Wrong issuer')) {
      throw badRequest('The Google ID token is from an unauthorized source');
    }
    if (error.message.includes('Email not verified')) {
      throw badRequest('Google account email must be verified');
    }

    // Generic error for unexpected issues
    throw badRequest('Google authentication failed. Please try again.');
  }
};
