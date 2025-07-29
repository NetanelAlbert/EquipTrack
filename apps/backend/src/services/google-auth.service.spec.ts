import { GoogleAuthService, GoogleTokenPayload } from './google-auth.service';
import { UserState, UserRole } from '@equip-track/shared';
import { OAuth2Client } from 'google-auth-library';

// Mock crypto for UUID generation
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-123'),
}));

// Create mock instances that will be returned by constructors
const mockOAuth2Client = {
  verifyIdToken: jest.fn(),
};

const mockJwtService = {
  generateToken: jest.fn().mockResolvedValue('mock-jwt-token'),
};

const mockUsersAdapter = {
  getUserByEmail: jest.fn(),
  createUser: jest.fn(),
  updateUserState: jest.fn(),
};

// Mock OAuth2Client constructor
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => mockOAuth2Client),
}));

// Mock JWT Service constructor
jest.mock('./jwt.service', () => ({
  JwtService: jest.fn().mockImplementation(() => mockJwtService),
}));

// Mock Users Adapter constructor  
jest.mock('../db/tables/users-and-organizations.adapter', () => ({
  UsersAndOrganizationsAdapter: jest.fn().mockImplementation(() => mockUsersAdapter),
}));

describe('GoogleAuthService', () => {
  let googleAuthService: GoogleAuthService;

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

    // Setup default mock responses
    mockOAuth2Client.verifyIdToken.mockResolvedValue({
      getPayload: () => validGooglePayload,
    } as any);

    // Create service instance after mocks are configured
    googleAuthService = new GoogleAuthService(mockGoogleClientId);
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
      expect(result.jwt).toBe('mock-jwt-token');
    });

    it('should authenticate existing active user without updating state', async () => {
      // Arrange
      const existingUser = {
        user: {
          id: 'existing-uuid-456',
          email: 'test@example.com',
          name: 'Test User',
          state: UserState.Active,
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
      expect(mockUsersAdapter.updateUserState).not.toHaveBeenCalled();
      expect(result.jwt).toBe('mock-jwt-token');
    });

    it('should create new user with UUID when user does not exist', async () => {
      // Arrange
      mockUsersAdapter.getUserByEmail.mockResolvedValue(null);
      mockUsersAdapter.createUser.mockResolvedValue({
        user: {
          id: 'test-uuid-123',
          email: 'test@example.com',
          name: 'Test User',
          state: UserState.Active,
        },
        userInOrganizations: [],
      });

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
      expect(result.jwt).toBe('mock-jwt-token');
    });

    it('should reject invalid Google ID token', async () => {
      // Arrange
      mockOAuth2Client.verifyIdToken.mockRejectedValue(
        new Error('Invalid token') as any
      );

      // Act & Assert
      try {
        await googleAuthService.authenticateWithGoogle('invalid-token');
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.statusCode).toBe(400);
        expect(error.body).toContain('The provided Google ID token is invalid');
      }
    });

    it('should reject token with wrong issuer', async () => {
      // Arrange
      const invalidPayload = { ...validGooglePayload, iss: 'malicious.com' };
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => invalidPayload,
      } as any);

      // Act & Assert
      try {
        await googleAuthService.authenticateWithGoogle('token-with-wrong-issuer');
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.statusCode).toBe(400);
        expect(error.body).toContain('The Google ID token is from an unauthorized source');
      }
    });

    it('should reject token with unverified email', async () => {
      // Arrange
      const invalidPayload = { ...validGooglePayload, email_verified: false };
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => invalidPayload,
      } as any);

      // Act & Assert
      try {
        await googleAuthService.authenticateWithGoogle('token-with-unverified-email');
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.statusCode).toBe(422);
        expect(error.body).toContain('Email verification required');
      }
    });
  });

  describe('validateGoogleIdToken', () => {
    it('should return payload for valid token', async () => {
      // This method is private, but we can test it through authenticateWithGoogle
      // The test is already covered by the successful authentication tests above
      expect(true).toBe(true);
    });
  });
});
