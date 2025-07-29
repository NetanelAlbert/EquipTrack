import { UserRole, UserInOrganization } from '@equip-track/shared';
import { UsersAndOrganizationsAdapter } from '../db/tables/users-and-organizations.adapter';

interface PermissionCache {
  userPermissions: Record<string, UserRole>;
  timestamp: number;
}

/**
 * Dynamic authentication service that validates permissions against the database
 * to ensure users have current access permissions regardless of JWT token staleness
 */
export class DynamicAuthService {
  private readonly usersAdapter: UsersAndOrganizationsAdapter;
  private readonly permissionCache = new Map<string, PermissionCache>();
  private readonly cacheExpiryMs = 2 * 60 * 1000; // 2 minutes cache

  constructor() {
    this.usersAdapter = new UsersAndOrganizationsAdapter();
  }

  /**
   * Validate user's current permission for an organization
   * Returns the user's current role if they have access, null if they don't
   */
  async validateUserOrganizationPermission(
    userId: string,
    organizationId: string
  ): Promise<UserRole | null> {
    try {
      // Check cache first
      const cacheKey = `${userId}:${organizationId}`;
      const cached = this.permissionCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached.timestamp)) {
        const role = cached.userPermissions[organizationId];
        return role || null;
      }

      // Fetch from database
      const userAndOrganizations = await this.usersAdapter.getUserAndAllOrganizations(userId);
      
      if (!userAndOrganizations) {
        return null;
      }

      // Create permissions map from database data
      const userPermissions = userAndOrganizations.userInOrganizations.reduce(
        (acc, org) => {
          acc[org.organizationId] = org.role;
          return acc;
        },
        {} as Record<string, UserRole>
      );

      // Cache the permissions for all organizations this user belongs to
      const permissionCache: PermissionCache = {
        userPermissions,
        timestamp: Date.now(),
      };

      // Cache for all organizations the user belongs to
      userAndOrganizations.userInOrganizations.forEach(org => {
        const key = `${userId}:${org.organizationId}`;
        this.permissionCache.set(key, permissionCache);
      });

      // Return the specific organization role
      return userPermissions[organizationId] || null;
    } catch (error) {
      console.error(`Error validating user organization permission for user ${userId} in org ${organizationId}:`, error);
      // In case of error, fallback to denying access for security
      return null;
    }
  }

  /**
   * Get all current organizations and roles for a user
   */
  async getUserCurrentOrganizations(userId: string): Promise<UserInOrganization[]> {
    try {
      const userAndOrganizations = await this.usersAdapter.getUserAndAllOrganizations(userId);
      return userAndOrganizations?.userInOrganizations || [];
    } catch (error) {
      console.error(`Error fetching user organizations for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Clear cache for a specific user (useful when permissions change)
   */
  invalidateUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.permissionCache.delete(key));
  }

  /**
   * Clear entire cache (useful for testing or system maintenance)
   */
  clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheExpiryMs;
  }

  /**
   * Clean up expired cache entries (call periodically)
   */
  cleanupExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, cache] of this.permissionCache.entries()) {
      if (now - cache.timestamp >= this.cacheExpiryMs) {
        this.permissionCache.delete(key);
      }
    }
  }
}