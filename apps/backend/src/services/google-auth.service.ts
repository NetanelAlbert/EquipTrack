import { OAuth2Client } from 'google-auth-library';
import { JwtService } from './jwt.service';
import { UsersAndOrganizationsAdapter } from '../db/tables/users-and-organizations.adapter';
import { User, UserState, UserRole } from '@equip-track/shared';
import { randomUUID } from 'crypto';
import {
  badRequest,
  unauthorized,
  forbidden,
  emailVerificationRequired,
} from '../api/responses';

/**
 * Google ID token payload structure
 */
export interface GoogleTokenPayload {
  iss: string; // Issuer (should be accounts.google.com or https://accounts.google.com)
  aud: string; // Audience (our Google Client ID)
  sub: string; // Subject (Google user ID)
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  iat: number; // Issued at
  exp: number; // Expiration time
}

/**
 * Service for handling Google ID token validation and user management
 */
export class GoogleAuthService {
  private readonly oAuth2Client: OAuth2Client;
  private readonly jwtService: JwtService;
  private readonly usersAdapter: UsersAndOrganizationsAdapter;
  private readonly googleClientId: string;

  constructor(googleClientId: string) {
    this.googleClientId = googleClientId;
    this.oAuth2Client = new OAuth2Client(googleClientId);
    this.jwtService = new JwtService();
    this.usersAdapter = new UsersAndOrganizationsAdapter();
  }

  /**
   * Validate Google ID token and return user authentication data
   */
  async authenticateWithGoogle(idToken: string): Promise<{
    jwt: string;
  }> {
    try {
      // Step 1: Validate the Google ID token
      const googlePayload = await this.validateGoogleIdToken(idToken);

      // Normalize email: trim whitespace and convert to lowercase
      const normalizedEmail = googlePayload.email.trim().toLowerCase();

      // Step 2: Check if user exists in our system by email
      let userAndOrganizations = await this.usersAdapter.getUserByEmail(
        normalizedEmail
      );

      if (userAndOrganizations) {
        console.log('User exists', userAndOrganizations);
        if (userAndOrganizations.user.state === UserState.Disabled) {
          console.log('User is disabled, responding with error');
          throw forbidden(
            'Your account has been disabled. Please contact your administrator.'
          );
        }
        // User exists - handle state transition if needed
        if (userAndOrganizations.user.state === UserState.Invited) {
          console.log(
            'User exists, updating state to active',
            userAndOrganizations.user
          );
          await this.usersAdapter.updateUserState(
            userAndOrganizations.user.id,
            UserState.Active
          );
          userAndOrganizations.user.state = UserState.Active;
        }
        if (userAndOrganizations.user.name !== googlePayload.name) {
          console.log('User exists, updating name', userAndOrganizations.user);
          await this.usersAdapter.updateUserName(
            userAndOrganizations.user.id,
            googlePayload.name
          );
          userAndOrganizations.user.name = googlePayload.name;
        }
      } else {
        // User doesn't exist - create new user with UUID and Disabled state
        const newUserId = randomUUID();
        const newUser: User = {
          id: newUserId,
          email: normalizedEmail,
          name: googlePayload.name,
          state: UserState.Active,
        };

        // Store Google sub for future reference
        await this.usersAdapter.createUser(newUser, googlePayload.sub);

        // Return user with empty organizations (admin needs to assign them)
        userAndOrganizations = {
          user: newUser,
          userInOrganizations: [],
        };
      }

      // Step 3: Generate JWT token
      const orgIdToRole = userAndOrganizations.userInOrganizations.reduce(
        (acc, org) => {
          acc[org.organizationId] = org.role;
          return acc;
        },
        {} as Record<string, UserRole>
      );
      const jwt = await this.jwtService.generateToken(
        userAndOrganizations.user.id,
        orgIdToRole
      );

      console.log(
        'successful google auth for user',
        userAndOrganizations.user.id
      );

      return {
        jwt,
      };
    } catch (error) {
      console.error('Google authentication error:', error);

      // If it's already a response object, re-throw it
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }

      // Handle specific error messages and convert to proper responses
      if (error.message.includes('Invalid token')) {
        throw badRequest('The provided Google ID token is invalid');
      }
      if (error.message.includes('Wrong issuer')) {
        throw badRequest('The Google ID token is from an unauthorized source');
      }
      if (error.message.includes('Token used too late')) {
        throw unauthorized(
          'The Google ID token has expired. Please sign in again.'
        );
      }
      if (error.message.includes('Email not verified')) {
        throw emailVerificationRequired(
          'Your Google account email must be verified to sign in'
        );
      }
      if (error.message.includes('Wrong audience')) {
        throw badRequest(
          'The Google ID token is not valid for this application'
        );
      }
      if (error.message.includes('Missing')) {
        throw badRequest('The Google ID token is missing required information');
      }

      // Generic error for unexpected issues
      throw badRequest('Google authentication failed. Please try again.');
    }
  }

  /**
   * Validate Google ID token and extract payload
   */
  private async validateGoogleIdToken(
    idToken: string
  ): Promise<GoogleTokenPayload> {
    try {
      const ticket = await this.oAuth2Client.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new Error('Invalid token: no payload');
      }

      // Verify issuer
      if (
        payload.iss !== 'accounts.google.com' &&
        payload.iss !== 'https://accounts.google.com'
      ) {
        throw new Error('Wrong issuer');
      }

      // Verify audience
      if (payload.aud !== this.googleClientId) {
        throw new Error('Wrong audience');
      }

      // Verify email is present and verified
      if (!payload.email || !payload.email_verified) {
        throw new Error('Email not verified');
      }

      // Verify sub (user ID) is present
      if (!payload.sub) {
        throw new Error('Missing user ID');
      }

      // Verify iat (issued at) is present
      if (!payload.iat) {
        throw new Error('Missing issued at time');
      }

      // Verify exp (expiration time) is present
      if (!payload.exp) {
        throw new Error('Missing expiration time');
      }

      return {
        iss: payload.iss,
        aud: payload.aud,
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name || payload.email,
        picture: payload.picture,
        given_name: payload.given_name,
        family_name: payload.family_name,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (error) {
      console.error('Google ID token validation error:', error);
      throw error;
    }
  }

  /**
   * Check if Google ID token is expired
   */
  isTokenExpired(payload: GoogleTokenPayload): boolean {
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }
}
