import { APIGatewayProxyEvent } from 'aws-lambda';
import { UserRole, EndpointMeta } from '@equip-track/shared';
import { unauthorized, forbidden } from './responses';

// Manual mocks for cleaner testing
const mockJwtService = {
  validateToken: jest.fn(),
  generateToken: jest.fn(),
  getUserIdFromToken: jest.fn(),
  isTokenExpired: jest.fn(),
  clearCache: jest.fn(),
};

// Mock modules at the top level
jest.mock('../services/jwt.service', () => ({
  JwtService: jest.fn().mockImplementation(() => mockJwtService),
}));

// Import after mocking
import { authenticate } from './auth';

describe('Optimized JWT Authentication System', () => {
  let mockEvent: APIGatewayProxyEvent;
  let mockMeta: EndpointMeta<any, any>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup basic mock event
    mockEvent = {
      headers: {},
      pathParameters: { organizationId: 'org-123' },
      requestContext: {} as any,
      httpMethod: 'GET',
      path: '/api/test',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      body: null,
      isBase64Encoded: false,
      resource: '',
      multiValueHeaders: {},
      stageVariables: null,
    };

    // Setup basic mock meta
    mockMeta = {
      path: '/api/organizations/{organizationId}/test',
      method: 'GET',
      allowedRoles: [UserRole.Admin, UserRole.Customer],
      requestType: undefined,
      responseType: undefined,
    };
  });

  describe('JWT Token Validation and Payload Usage', () => {
    it('should successfully authenticate with valid JWT token using payload data', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      mockEvent.headers['Authorization'] = `Bearer ${validToken}`;

      mockJwtService.validateToken.mockResolvedValue({
        sub: 'user-123',
        orgIdToRole: { 'org-123': UserRole.Admin },
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Act
      const result = await authenticate(mockMeta, mockEvent);

      // Assert
      expect(result).toBe(true);
      expect(mockJwtService.validateToken).toHaveBeenCalledWith(validToken);
      // No database calls should be made
      expect(mockJwtService.validateToken).toHaveBeenCalledTimes(1);
    });

    it('should reject request with missing Authorization header', async () => {
      // Arrange
      // No Authorization header in mockEvent

      // Act & Assert
      await expect(authenticate(mockMeta, mockEvent)).rejects.toEqual(
        unauthorized('Authorization header is required')
      );
      expect(mockJwtService.validateToken).not.toHaveBeenCalled();
    });

    it('should reject request with malformed Authorization header', async () => {
      // Arrange
      mockEvent.headers['Authorization'] = 'InvalidFormat token';

      // Act & Assert
      await expect(authenticate(mockMeta, mockEvent)).rejects.toEqual(
        unauthorized('Authorization header must be in format: Bearer <token>')
      );
      expect(mockJwtService.validateToken).not.toHaveBeenCalled();
    });

    it('should handle expired JWT tokens', async () => {
      // Arrange
      const expiredToken = 'expired.jwt.token';
      mockEvent.headers['Authorization'] = `Bearer ${expiredToken}`;

      mockJwtService.validateToken.mockRejectedValue(
        new Error('Authentication token has expired')
      );

      // Act & Assert
      await expect(authenticate(mockMeta, mockEvent)).rejects.toEqual(
        unauthorized('Authentication token has expired')
      );
      expect(mockJwtService.validateToken).toHaveBeenCalledWith(expiredToken);
    });

    it('should handle invalid JWT tokens', async () => {
      // Arrange
      const invalidToken = 'invalid.jwt.token';
      mockEvent.headers['Authorization'] = `Bearer ${invalidToken}`;

      mockJwtService.validateToken.mockRejectedValue(
        new Error('Invalid authentication token')
      );

      // Act & Assert
      await expect(authenticate(mockMeta, mockEvent)).rejects.toEqual(
        unauthorized('Invalid authentication token')
      );
      expect(mockJwtService.validateToken).toHaveBeenCalledWith(invalidToken);
    });

    it('should handle JWT tokens without user ID', async () => {
      // Arrange
      const tokenWithoutSub = 'token.without.sub';
      mockEvent.headers['Authorization'] = `Bearer ${tokenWithoutSub}`;

      mockJwtService.validateToken.mockResolvedValue({
        sub: undefined as any,
        orgIdToRole: { 'org-123': UserRole.Admin },
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Act & Assert
      await expect(authenticate(mockMeta, mockEvent)).rejects.toEqual(
        unauthorized('Invalid token: user ID not found')
      );
    });

    it('should handle case-insensitive Authorization header', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      mockEvent.headers['authorization'] = `bearer ${validToken}`; // lowercase

      mockJwtService.validateToken.mockResolvedValue({
        sub: 'user-123',
        orgIdToRole: { 'org-123': UserRole.Admin },
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Act
      const result = await authenticate(mockMeta, mockEvent);

      // Assert
      expect(result).toBe(true);
      expect(mockJwtService.validateToken).toHaveBeenCalledWith(validToken);
    });
  });

  describe('Organization Validation Using JWT Payload', () => {
    it('should reject when user is not a member of the organization (not in orgIdToRole)', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      mockEvent.headers['Authorization'] = `Bearer ${validToken}`;

      mockJwtService.validateToken.mockResolvedValue({
        sub: 'user-123',
        orgIdToRole: { 'org-456': UserRole.Admin }, // Different org ID
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Act & Assert
      await expect(authenticate(mockMeta, mockEvent)).rejects.toEqual(
        forbidden('User is not a member of the organization')
      );
    });

    it('should reject when user role is not allowed for endpoint', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      mockEvent.headers['Authorization'] = `Bearer ${validToken}`;

      // User has role WarehouseManager, but endpoint only allows Admin and Customer
      mockJwtService.validateToken.mockResolvedValue({
        sub: 'user-123',
        orgIdToRole: { 'org-123': UserRole.WarehouseManager },
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Act & Assert
      await expect(authenticate(mockMeta, mockEvent)).rejects.toEqual(
        forbidden(
          `User Role ${UserRole.WarehouseManager} is not allowed to access this endpoint`
        )
      );
    });

    it('should succeed when user has correct role for organization', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      mockEvent.headers['Authorization'] = `Bearer ${validToken}`;

      mockJwtService.validateToken.mockResolvedValue({
        sub: 'user-123',
        orgIdToRole: { 'org-123': UserRole.Customer },
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Act
      const result = await authenticate(mockMeta, mockEvent);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected JWT service errors', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      mockEvent.headers['Authorization'] = `Bearer ${validToken}`;

      mockJwtService.validateToken.mockRejectedValue(
        new Error('Unexpected error')
      );

      // Act & Assert
      await expect(authenticate(mockMeta, mockEvent)).rejects.toEqual(
        unauthorized('Authentication failed')
      );
    });

    it('should preserve existing error responses', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      mockEvent.headers['Authorization'] = `Bearer ${validToken}`;

      const existingError = unauthorized('Custom error');
      mockJwtService.validateToken.mockRejectedValue(existingError);

      // Act & Assert
      await expect(authenticate(mockMeta, mockEvent)).rejects.toEqual(
        existingError
      );
    });
  });
});
