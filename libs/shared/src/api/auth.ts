import { User, UserInOrganization, UserRole } from '../elements';
import { BasicResponse } from './basic';

/**
 * Request to authenticate with Google ID token
 */
export interface GoogleAuthRequest {
  idToken: string;
}

/**
 * Response from Google authentication containing JWT and user info
 */
export interface GoogleAuthResponse extends BasicResponse {
  jwt: string;
}

/**
 * JWT payload interface with user, organization, and role information
 */
export interface JwtPayload {
  sub: string; // User ID
  orgIdToRole: Record<string, UserRole>;
  iat: number; // Issued at
  exp: number; // Expiration time
}

/**
 * Response from token refresh containing new JWT
 */
export interface RefreshTokenResponse extends BasicResponse {
  jwt: string;
  organizationsCount: number;
  message: string;
}
