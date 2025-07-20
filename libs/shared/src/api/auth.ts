import { User, UserInOrganization } from '../elements';
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