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
  user: User;
  userInOrganizations: UserInOrganization[];
}

/**
 * JWT payload interface matching backend implementation
 */
export interface JwtPayload {
  userId: string;
  orgIdToRole: Record<string, UserRole>;
  iat: number;
  exp: number;
}

/**
 * Decoded JWT with user information
 */
export interface DecodedJwt extends JwtPayload {
  user: User;
  userInOrganizations: UserInOrganization[];
}
