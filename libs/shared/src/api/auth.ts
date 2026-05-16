import { UserRole } from '../elements';
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
 * Request to mint deterministic JWT for E2E tests.
 * Protected by backend environment flags and X-E2E-Secret header.
 */
export interface E2eAuthRequest {
  userId: string;
  orgIdToRole: Record<string, UserRole>;
}

/**
 * Response for E2E authentication endpoint.
 */
export interface E2eAuthResponse extends BasicResponse {
  jwt: string;
}

/**
 * Email/password login for preview environments only (LocalStack or dedicated preview stacks).
 * Disabled unless FEATURE_PREVIEW_AUTH_ENABLED is set on the backend.
 */
export interface FeaturePreviewPasswordRequest {
  email: string;
  password: string;
}

/**
 * Response for feature preview password authentication.
 */
export interface FeaturePreviewPasswordResponse extends BasicResponse {
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
