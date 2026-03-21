import { GoogleAuthService, GoogleTokenPayload } from './google-auth.service';
import { UserState, UserRole } from '@equip-track/shared';
import { OAuth2Client } from 'google-auth-library';
import { badRequest, emailVerificationRequired } from '../api/responses';

// Mock crypto for UUID generation
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-123'),
}));

// Mock OAuth2Client
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(),
}));

// Shared mock instances so GoogleAuthService and assertions use the same fns
jest.mock('./jwt.service', () => {
  const mockJwt = {
    generateToken: jest.fn().mockResolvedValue('mock-jwt-token'),
  };
  return {
    JwtService: jest.fn().mockImplementation(() => mockJwt),
    __mockJwt: mockJwt,
  };
});

jest.mock('../db/tables/users-and-organizations.adapter', () => {
  const mockAdapter = {
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    updateUserState: jest.fn(),
    updateUserName: jest.fn(),
  };
  return {
    UsersAndOrganizationsAdapter: jest
      .fn()
      .mockImplementation(() => mockAdapter),
    __mockAdapter: mockAdapter,
  };
});

const { __mockJwt: mockJwtService } = jest.requireMock<{
  __mockJwt: { generateToken: jest.Mock };
}>('./jwt.service');
const { __mockAdapter: mockUsersAdapter } = jest.requireMock<{
  __mockAdapter: {
    getUserByEmail: jest.Mock;
    createUser: jest.Mock;
    updateUserState: jest.Mock;
    updateUserName: jest.Mock;
  };
}>('../db/tables/users-and-organizations.adapter');

describe('GoogleAuthService', () => {
  let googleAuthService: GoogleAuthService;
  let mockOAuth2Client: { verifyIdToken: jest.Mock };

  const mockGoogleClientId = 'test-google-client-id';
  const validGooglePayload: GoogleTokenPayload = {
    iss: 'accounts.google.com',
    aud: mockGoogleClientId,
    sub: 'google-user-123',
    email: 'test@example.com',
    email_verified: true,
    name: 'Test User',
    iat: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup OAuth2Client mock
    mockOAuth2Client = {
      verifyIdToken: jest.fn(),
    };
    (OAuth2Client as any).mockImplementation(() => mockOAuth2Client);

    // Setup service
    googleAuthService = new GoogleAuthService(mockGoogleClientId);

    // Setup default mock responses
    mockOAuth2Client.verifyIdToken.mockResolvedValue({
      getPayload: () => validGooglePayload,
    } as any);
  });

  describe('authenticateWithGoogle', () => {
    it('should authenticate existing invited user and update state to active', async () => {
      // Arrange
      const existingUser = {
        user: {
          id: 'existing-uuid-456',
          email: 'test@example.com',
          name: 'Test User',
          state: UserState.Invited,
        },
        userInOrganizations: [
          {
            organizationId: 'org-123',
            userId: 'existing-uuid-456',
            role: UserRole.Customer,
          },
        ],
      };

      mockUsersAdapter.getUserByEmail.mockResolvedValue(existingUser);

      // Act
      const result = await googleAuthService.authenticateWithGoogle(
        'valid-id-token'
      );

      // Assert
      expect(mockUsersAdapter.getUserByEmail).toHaveBeenCalledWith(
        'test@example.com'
      );
      expect(mockUsersAdapter.updateUserState).toHaveBeenCalledWith(
        'existing-uuid-456',
        UserState.Active
      );
      expect(mockJwtService.generateToken).toHaveBeenCalledWith(
        'existing-uuid-456',
        { 'org-123': UserRole.Customer }
      );
      expect(result.jwt).toBe('mock-jwt-token');
    });

    it('should authenticate existing active user without updating state', async () => {
      // Arrange
      const existingUser = {
        user: {
          id: 'existing-uuid-789',
          email: 'test@example.com',
          name: 'Test User',
          state: UserState.Active,
        },
        userInOrganizations: [
          {
            organizationId: 'org-123',
            userId: 'existing-uuid-789',
            role: UserRole.Admin,
          },
        ],
      };

      mockUsersAdapter.getUserByEmail.mockResolvedValue(existingUser);

      // Act
      const result = await googleAuthService.authenticateWithGoogle(
        'valid-id-token'
      );

      // Assert
      expect(mockUsersAdapter.getUserByEmail).toHaveBeenCalledWith(
        'test@example.com'
      );
      expect(mockUsersAdapter.updateUserState).not.toHaveBeenCalled();
      expect(mockJwtService.generateToken).toHaveBeenCalledWith(
        'existing-uuid-789',
        { 'org-123': UserRole.Admin }
      );
      expect(result.jwt).toBe('mock-jwt-token');
    });

    it('should create new user with UUID when user does not exist', async () => {
      // Arrange
      mockUsersAdapter.getUserByEmail.mockResolvedValue(null);

      // Act
      const result = await googleAuthService.authenticateWithGoogle(
        'valid-id-token'
      );

      // Assert
      expect(mockUsersAdapter.getUserByEmail).toHaveBeenCalledWith(
        'test@example.com'
      );
      expect(mockUsersAdapter.createUser).toHaveBeenCalledWith(
        {
          id: 'test-uuid-123',
          email: 'test@example.com',
          name: 'Test User',
          state: UserState.Active,
        },
        'google-user-123'
      );
      expect(mockJwtService.generateToken).toHaveBeenCalledWith(
        'test-uuid-123',
        {}
      );
      expect(result.jwt).toBe('mock-jwt-token');
    });

    it('should reject invalid Google ID token', async () => {
      // Arrange
      mockOAuth2Client.verifyIdToken.mockRejectedValue(
        new Error('Invalid token') as any
      );

      // Act & Assert
      await expect(
        googleAuthService.authenticateWithGoogle('invalid-token')
      ).rejects.toEqual(
        badRequest('The provided Google ID token is invalid')
      );
    });

    it('should reject token with wrong issuer', async () => {
      // Arrange
      const invalidPayload = { ...validGooglePayload, iss: 'malicious.com' };
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => invalidPayload,
      } as any);

      // Act & Assert
      await expect(
        googleAuthService.authenticateWithGoogle('token-with-wrong-issuer')
      ).rejects.toEqual(
        badRequest('The Google ID token is from an unauthorized source')
      );
    });

    it('should reject token with unverified email', async () => {
      // Arrange
      const invalidPayload = { ...validGooglePayload, email_verified: false };
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => invalidPayload,
      } as any);

      // Act & Assert
      await expect(
        googleAuthService.authenticateWithGoogle('token-with-unverified-email')
      ).rejects.toEqual(
        emailVerificationRequired(
          'Your Google account email must be verified to sign in'
        )
      );
    });
  });

  describe('validateGoogleIdToken', () => {
    it('should validate a properly formatted Google ID token', async () => {
      // Arrange
      const service = googleAuthService as any; // Access private method

      // Act
      const result = await service.validateGoogleIdToken('valid-token');

      // Assert
      expect(result).toEqual(validGooglePayload);
      expect(mockOAuth2Client.verifyIdToken).toHaveBeenCalledWith({
        idToken: 'valid-token',
        audience: mockGoogleClientId,
      });
    });

    it('should reject token with no payload', async () => {
      // Arrange
      const service = googleAuthService as any;
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => null,
      } as any);

      // Act & Assert
      await expect(
        service.validateGoogleIdToken('token-no-payload')
      ).rejects.toThrow();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      // Arrange
      const validPayload = {
        ...validGooglePayload,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      // Act
      const result = googleAuthService.isTokenExpired(validPayload);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for expired token', () => {
      // Arrange
      const expiredPayload = {
        ...validGooglePayload,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      // Act
      const result = googleAuthService.isTokenExpired(expiredPayload);

      // Assert
      expect(result).toBe(true);
    });
  });
});
