import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import * as jwt from 'jsonwebtoken';
import { UserRole } from '@equip-track/shared';

/**
 * JWT payload interface with user, organization, and role information
 */
export interface JwtPayload {
  sub: string; // User ID
  organizationId: string;
  role: UserRole;
  iat: number; // Issued at
  exp: number; // Expiration time
}

/**
 * JWT service for token generation and validation using RS256 algorithm
 * Integrates with AWS Secrets Manager for secure key storage with caching
 */
export class JwtService {
  private readonly secretsClient: SecretsManagerClient;
  private readonly privateKeySecretName = 'equip-track/jwt-private-key';
  private readonly publicKeySecretName = 'equip-track/jwt-public-key';

  // Cache for keys to avoid repeated Secrets Manager calls
  private privateKeyCache: { key: string; timestamp: number } | null = null;
  private publicKeyCache: { key: string; timestamp: number } | null = null;
  private readonly cacheExpiry = 5 * 60 * 1000; // 5 minutes in milliseconds

  constructor() {
    this.secretsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Generate a JWT token with user, organization, and role information
   * Token expires in 1 week (7 days)
   */
  async generateToken(
    userId: string,
    organizationId: string,
    role: UserRole
  ): Promise<string> {
    try {
      const privateKey = await this.getPrivateKey();
      const now = Math.floor(Date.now() / 1000);
      const oneWeekInSeconds = 7 * 24 * 60 * 60; // 7 days

      const payload: JwtPayload = {
        sub: userId,
        organizationId,
        role,
        iat: now,
        exp: now + oneWeekInSeconds,
      };

      return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        issuer: 'equip-track',
        audience: 'equip-track-users',
      });
    } catch (error) {
      console.error('Error generating JWT token:', error);
      throw new Error('Failed to generate authentication token');
    }
  }

  /**
   * Validate and decode a JWT token
   * Returns the decoded payload if valid, throws error if invalid
   */
  async validateToken(token: string): Promise<JwtPayload> {
    try {
      const publicKey = await this.getPublicKey();

      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: 'equip-track',
        audience: 'equip-track-users',
      }) as JwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid authentication token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Authentication token has expired');
      }
      console.error('Error validating JWT token:', error);
      throw new Error('Token validation failed');
    }
  }

  /**
   * Extract user ID from JWT token without full validation
   * Used for quick user identification
   */
  getUserIdFromToken(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      return decoded?.sub || null;
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return null;
    }
  }

  /**
   * Check if a token is expired without full validation
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      if (!decoded || !decoded.exp) {
        return true;
      }
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get private key from AWS Secrets Manager with caching
   */
  private async getPrivateKey(): Promise<string> {
    if (
      this.privateKeyCache &&
      this.isKeyValid(this.privateKeyCache.timestamp)
    ) {
      return this.privateKeyCache.key;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: this.privateKeySecretName,
      });

      const response = await this.secretsClient.send(command);

      if (!response.SecretString) {
        throw new Error('Private key not found in secrets manager');
      }

      this.privateKeyCache = {
        key: response.SecretString,
        timestamp: Date.now(),
      };

      return response.SecretString;
    } catch (error) {
      console.error(
        'Error retrieving private key from Secrets Manager:',
        error
      );
      throw new Error('Failed to retrieve private key');
    }
  }

  /**
   * Get public key from AWS Secrets Manager with caching
   */
  private async getPublicKey(): Promise<string> {
    if (this.publicKeyCache && this.isKeyValid(this.publicKeyCache.timestamp)) {
      return this.publicKeyCache.key;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: this.publicKeySecretName,
      });

      const response = await this.secretsClient.send(command);

      if (!response.SecretString) {
        throw new Error('Public key not found in secrets manager');
      }

      this.publicKeyCache = {
        key: response.SecretString,
        timestamp: Date.now(),
      };

      return response.SecretString;
    } catch (error) {
      console.error('Error retrieving public key from Secrets Manager:', error);
      throw new Error('Failed to retrieve public key');
    }
  }

  /**
   * Check if cached key is still valid (within cache expiry time)
   */
  private isKeyValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheExpiry;
  }

  /**
   * Clear the key cache (useful for testing or force refresh)
   */
  clearCache(): void {
    this.privateKeyCache = null;
    this.publicKeyCache = null;
  }
}
