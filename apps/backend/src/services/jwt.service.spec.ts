import { JwtService, JwtPayload } from './jwt.service';
import { UserRole } from '@equip-track/shared';
import * as jwt from 'jsonwebtoken';

// Test RSA key pair for testing
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDL9LB3kAjUAl6c
8H6eb7FFABWCQ6vSGi3blVVAIhzTFrytonR9e6IcDpDNx0NGaUzE0s8Q1X4p/idw
nJnDWB6nsSvXfU5+eB9mO2o1JfkAoJ9s0cHVgIgZ4OCVh6h4riGchmAFRYjZULZW
1SAuNaMUqoX9b6jo7N3BI653FDxqnrIwJ1CWPFDBRwjxunNDWtxJQDPsEnq84yaf
gEIw686Sz9pkPZiSzGHaPIHfT7rXJgstR8c/ZUFdz21ucVQ0z9aT+EU7b9CWmuuQ
RcVqHCkTC5sqs7OTvnf41Y/eJGYmZtUclMnt/knOq+wOe99Gs/NwFVqOnduKDQd1
gp0FYxXLAgMBAAECggEAEMSRLYM99pArTyPGhSgRnuae3hLKMX/NfVwNojQrwn8A
DBZrFVXwwfXAmepj8Yn+sb/THkMvGCy4+V0mlxTLkGXUgObgaS1fB3yjArOYgSCz
erLUCMWEavw9+o0ooKNQSBoUEtrgoV0tYH4tIx9txOkwEuH3NQ8kPBi+4zNatDkq
K46GbjZ2iVg4uEeny0Sq6nK5DaXDIHeA+46tr12ToBd0QuMbcUkGj8z0U5jS+LHk
ppLyHWwFfK+tmZsAxP4wFC0BQ/gUA3K0GFjoz0S9UrJ+6mhJ44x222oRmatzgv26
mJVz9OfYXAYelY7icHhadA/iBRSgI0FI4LuE+rYFIQKBgQD05w3TE8XZn/SS+0B9
L4dTSkvXfG7C73G8xrwr4Pcea32UnzVl8AZ/ApbRA/yxCT2IbVi8iyx5vdG0w5WD
74m3I1sJvs6szZ0fpbsuaNnXNDDBM+xwnkoNG/Ul8bLA8HoVqWXHIZX74FUBL5tD
VjFQ4UEnc6uBShb8uLJGs+JbvwKBgQDVMqPxmKgIh3BkEvdkW9WFnfM+lJDdtP3L
AgX55cB4xOsOu7/eC0eCQbgerjo1olhjLc2PV8FJ94y4y+YnUIlZrG3XSH3Ke7OC
B/OiNaPJ0fChecMQ+51attJ95DjDgL8PWhgt1ATY3X9GTQmpFXAPoMXYyOiaHOyI
dMPnCDC49QKBgQDXbCcM9Oekdr98SuZ/N7+h1EjCVAJaFqXFmEsNjeXSLFta0HD4
KhqMvopLcWZlk+s8hnL35rRIomBE0YZDeAF7xu3dtKm392Wu4Om1+SUl2BLK4BGr
PpGE1oLdza2faej6BPgyIaj81mfvkyDQKpFWw828FlNWdwWhaBXpe3IxoQKBgDYv
zc1tAGBSlDVLQMeoM6fnUli4h+1hwBOl6wDt7TKE0j2HaKe19DHeJD7gB3l0TsS+
cn2ZT05OddzOLiwV4yMAmVZbXWVmdWR6QukaewujqWZRPUwGt6LDztIifG7sPSNY
wcZ8GdNI0L18fRUVlsrSERcdUUlCSrgP/W6t/Tw1AoGAFD1JCBSBjPXUJPTkagkd
SWWnbNj6Wq0157yRCk4pqNMpjRLbeKhvNH9r6X05UVwkREkixr5bqVqDwdxX2bh9
bZw5bmD1vE3mfj1+WeIEHD0iEqFYWvi6KD0tof6yMPwiEGvU5nh864To1grUi7WH
b/lXpIOTmzMRc7+q5rEhopg=
-----END PRIVATE KEY-----`;

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAy/Swd5AI1AJenPB+nm+x
RQAVgkOr0hot25VVQCIc0xa8raJ0fXuiHA6QzcdDRmlMxNLPENV+Kf4ncJyZw1ge
p7Er131OfngfZjtqNSX5AKCfbNHB1YCIGeDglYeoeK4hnIZgBUWI2VC2VtUgLjWj
FKqF/W+o6OzdwSOudxQ8ap6yMCdQljxQwUcI8bpzQ1rcSUAz7BJ6vOMmn4BCMOvO
ks/aZD2Yksxh2jyB30+61yYLLUfHP2VBXc9tbnFUNM/Wk/hFO2/QlprrkEXFahwp
EwubKrOzk753+NWP3iRmJmbVHJTJ7f5JzqvsDnvfRrPzcBVajp3big0HdYKdBWMV
ywIDAQAB
-----END PUBLIC KEY-----`;

describe('JwtService', () => {
  let jwtService: JwtService;
  let mockSecretClient: any;

  beforeEach(() => {
    // Mock the AWS Secrets Manager client
    mockSecretClient = {
      send: jest.fn(),
    };

    // Mock the Secrets Manager module
    jest.doMock('@aws-sdk/client-secrets-manager', () => ({
      SecretsManagerClient: jest.fn(() => mockSecretClient),
      GetSecretValueCommand: jest.fn((input) => ({ input })),
    }));

    // Setup mock responses
    mockSecretClient.send.mockImplementation((command: any) => {
      const secretId = command.input?.SecretId || command.SecretId;
      if (secretId === 'equip-track/jwt-private-key') {
        return Promise.resolve({ SecretString: TEST_PRIVATE_KEY });
      }
      if (secretId === 'equip-track/jwt-public-key') {
        return Promise.resolve({ SecretString: TEST_PUBLIC_KEY });
      }
      return Promise.reject(new Error('Secret not found'));
    });

    // Create service instance
    jwtService = new JwtService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token with user, organization, and role claims', async () => {
      // Arrange
      const userId = 'test-user-123';
      const organizationId = 'test-org-456';
      const role = UserRole.Admin;

      // Act
      const token = await jwtService.generateToken(
        userId,
        organizationId,
        role
      );

      // Assert
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Decode the token to verify contents
      const decoded = jwt.decode(token) as JwtPayload;
      expect(decoded.sub).toBe(userId);
      expect(decoded.organizationId).toBe(organizationId);
      expect(decoded.role).toBe(role);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();

      // Verify expiration is approximately 1 week from now
      const oneWeek = 7 * 24 * 60 * 60;
      expect(decoded.exp - decoded.iat).toBe(oneWeek);

      // Verify token can be verified with public key
      const isValid = jwt.verify(token, TEST_PUBLIC_KEY, {
        algorithms: ['RS256'],
        issuer: 'equip-track',
        audience: 'equip-track-users',
      });
      expect(isValid).toBeDefined();
    });

    it('should handle Secrets Manager errors gracefully', async () => {
      // Arrange
      mockSecretClient.send.mockRejectedValue(new Error('AWS Error'));

      // Act & Assert
      await expect(
        jwtService.generateToken('user', 'org', UserRole.Customer)
      ).rejects.toThrow('Failed to generate authentication token');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid JWT token and return decoded payload', async () => {
      // Arrange
      const userId = 'test-user-123';
      const organizationId = 'test-org-456';
      const role = UserRole.WarehouseManager;

      // Generate a valid token first
      const token = await jwtService.generateToken(
        userId,
        organizationId,
        role
      );

      // Act
      const decoded = await jwtService.validateToken(token);

      // Assert
      expect(decoded.sub).toBe(userId);
      expect(decoded.organizationId).toBe(organizationId);
      expect(decoded.role).toBe(role);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('utility methods', () => {
    it('should extract user ID from token without validation', () => {
      // Arrange
      const payload = {
        sub: 'test-user-123',
        organizationId: 'org',
        role: UserRole.Admin,
      };
      const token = jwt.sign(payload, 'secret'); // Simple token for testing

      // Act
      const userId = jwtService.getUserIdFromToken(token);

      // Assert
      expect(userId).toBe('test-user-123');
    });

    it('should return null for invalid token when extracting user ID', () => {
      // Act
      const userId = jwtService.getUserIdFromToken('invalid-token');

      // Assert
      expect(userId).toBeNull();
    });

    it('should correctly identify expired tokens', () => {
      // Arrange - create expired token
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload = { exp: now - 3600 }; // Expired 1 hour ago
      const expiredToken = jwt.sign(expiredPayload, 'secret');

      // Act
      const isExpired = jwtService.isTokenExpired(expiredToken);

      // Assert
      expect(isExpired).toBe(true);
    });

    it('should correctly identify valid tokens', () => {
      // Arrange - create valid token
      const now = Math.floor(Date.now() / 1000);
      const validPayload = { exp: now + 3600 }; // Expires in 1 hour
      const validToken = jwt.sign(validPayload, 'secret');

      // Act
      const isExpired = jwtService.isTokenExpired(validToken);

      // Assert
      expect(isExpired).toBe(false);
    });
  });
});
