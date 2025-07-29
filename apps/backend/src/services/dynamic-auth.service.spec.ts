import { DynamicAuthService } from './dynamic-auth.service';
import { UsersAndOrganizationsAdapter } from '../db/tables/users-and-organizations.adapter';
import { UserRole } from '@equip-track/shared';

// Mock the UsersAndOrganizationsAdapter
jest.mock('../db/tables/users-and-organizations.adapter');

describe('DynamicAuthService', () => {
  let dynamicAuthService: DynamicAuthService;
  let mockUsersAdapter: jest.Mocked<UsersAndOrganizationsAdapter>;

  beforeEach(() => {
    dynamicAuthService = new DynamicAuthService();
    mockUsersAdapter = (dynamicAuthService as any).usersAdapter;
    dynamicAuthService.clearCache();
  });

  describe('validateUserOrganizationPermission', () => {
    it('should return user role when user has access to organization', async () => {
      const userId = 'user-123';
      const organizationId = 'org-456';
      const userRole = UserRole.Admin;

      mockUsersAdapter.getUserAndAllOrganizations.mockResolvedValue({
        user: { id: userId, name: 'Test User', email: 'test@example.com', state: 'Active' },
        userInOrganizations: [
          { userId, organizationId, role: userRole }
        ]
      });

      const result = await dynamicAuthService.validateUserOrganizationPermission(userId, organizationId);

      expect(result).toBe(userRole);
      expect(mockUsersAdapter.getUserAndAllOrganizations).toHaveBeenCalledWith(userId);
    });

    it('should return null when user does not have access to organization', async () => {
      const userId = 'user-123';
      const organizationId = 'org-456';

      mockUsersAdapter.getUserAndAllOrganizations.mockResolvedValue({
        user: { id: userId, name: 'Test User', email: 'test@example.com', state: 'Active' },
        userInOrganizations: [
          { userId, organizationId: 'org-different', role: UserRole.Admin }
        ]
      });

      const result = await dynamicAuthService.validateUserOrganizationPermission(userId, organizationId);

      expect(result).toBeNull();
    });

    it('should return null when user does not exist', async () => {
      const userId = 'user-123';
      const organizationId = 'org-456';

      mockUsersAdapter.getUserAndAllOrganizations.mockResolvedValue(undefined);

      const result = await dynamicAuthService.validateUserOrganizationPermission(userId, organizationId);

      expect(result).toBeNull();
    });

    it('should cache permissions and use cache on subsequent calls', async () => {
      const userId = 'user-123';
      const organizationId = 'org-456';
      const userRole = UserRole.WarehouseManager;

      mockUsersAdapter.getUserAndAllOrganizations.mockResolvedValue({
        user: { id: userId, name: 'Test User', email: 'test@example.com', state: 'Active' },
        userInOrganizations: [
          { userId, organizationId, role: userRole },
          { userId, organizationId: 'org-789', role: UserRole.Customer }
        ]
      });

      // First call
      const result1 = await dynamicAuthService.validateUserOrganizationPermission(userId, organizationId);
      expect(result1).toBe(userRole);

      // Second call should use cache
      const result2 = await dynamicAuthService.validateUserOrganizationPermission(userId, organizationId);
      expect(result2).toBe(userRole);

      // Should only call the adapter once due to caching
      expect(mockUsersAdapter.getUserAndAllOrganizations).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors gracefully and return null', async () => {
      const userId = 'user-123';
      const organizationId = 'org-456';

      mockUsersAdapter.getUserAndAllOrganizations.mockRejectedValue(new Error('Database error'));

      const result = await dynamicAuthService.validateUserOrganizationPermission(userId, organizationId);

      expect(result).toBeNull();
    });

    it('should cache permissions for all user organizations', async () => {
      const userId = 'user-123';
      const org1 = 'org-456';
      const org2 = 'org-789';

      mockUsersAdapter.getUserAndAllOrganizations.mockResolvedValue({
        user: { id: userId, name: 'Test User', email: 'test@example.com', state: 'Active' },
        userInOrganizations: [
          { userId, organizationId: org1, role: UserRole.Admin },
          { userId, organizationId: org2, role: UserRole.Customer }
        ]
      });

      // Call for first organization
      const result1 = await dynamicAuthService.validateUserOrganizationPermission(userId, org1);
      expect(result1).toBe(UserRole.Admin);

      // Call for second organization should use cached data
      const result2 = await dynamicAuthService.validateUserOrganizationPermission(userId, org2);
      expect(result2).toBe(UserRole.Customer);

      // Should only call the adapter once
      expect(mockUsersAdapter.getUserAndAllOrganizations).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserCurrentOrganizations', () => {
    it('should return user organizations', async () => {
      const userId = 'user-123';
      const userInOrganizations = [
        { userId, organizationId: 'org-456', role: UserRole.Admin },
        { userId, organizationId: 'org-789', role: UserRole.Customer }
      ];

      mockUsersAdapter.getUserAndAllOrganizations.mockResolvedValue({
        user: { id: userId, name: 'Test User', email: 'test@example.com', state: 'Active' },
        userInOrganizations
      });

      const result = await dynamicAuthService.getUserCurrentOrganizations(userId);

      expect(result).toEqual(userInOrganizations);
    });

    it('should return empty array when user not found', async () => {
      const userId = 'user-123';

      mockUsersAdapter.getUserAndAllOrganizations.mockResolvedValue(undefined);

      const result = await dynamicAuthService.getUserCurrentOrganizations(userId);

      expect(result).toEqual([]);
    });

    it('should return empty array on database error', async () => {
      const userId = 'user-123';

      mockUsersAdapter.getUserAndAllOrganizations.mockRejectedValue(new Error('Database error'));

      const result = await dynamicAuthService.getUserCurrentOrganizations(userId);

      expect(result).toEqual([]);
    });
  });

  describe('cache management', () => {
    it('should invalidate cache for specific user', async () => {
      const userId = 'user-123';
      const organizationId = 'org-456';

      // Setup initial cache
      mockUsersAdapter.getUserAndAllOrganizations.mockResolvedValue({
        user: { id: userId, name: 'Test User', email: 'test@example.com', state: 'Active' },
        userInOrganizations: [
          { userId, organizationId, role: UserRole.Admin }
        ]
      });

      // First call to populate cache
      await dynamicAuthService.validateUserOrganizationPermission(userId, organizationId);

      // Invalidate cache
      dynamicAuthService.invalidateUserCache(userId);

      // Next call should hit the database again
      await dynamicAuthService.validateUserOrganizationPermission(userId, organizationId);

      expect(mockUsersAdapter.getUserAndAllOrganizations).toHaveBeenCalledTimes(2);
    });

    it('should clear entire cache', async () => {
      const userId1 = 'user-123';
      const userId2 = 'user-456';
      const organizationId = 'org-789';

      mockUsersAdapter.getUserAndAllOrganizations.mockResolvedValue({
        user: { id: userId1, name: 'Test User', email: 'test@example.com', state: 'Active' },
        userInOrganizations: [
          { userId: userId1, organizationId, role: UserRole.Admin }
        ]
      });

      // Populate cache for multiple users
      await dynamicAuthService.validateUserOrganizationPermission(userId1, organizationId);
      await dynamicAuthService.validateUserOrganizationPermission(userId2, organizationId);

      // Clear entire cache
      dynamicAuthService.clearCache();

      // Next calls should hit the database again
      await dynamicAuthService.validateUserOrganizationPermission(userId1, organizationId);

      expect(mockUsersAdapter.getUserAndAllOrganizations).toHaveBeenCalledTimes(3);
    });

    it('should expire cache after timeout', async () => {
      // Spy on Date.now to control time
      const mockDate = jest.spyOn(Date, 'now');
      const startTime = 1000000;
      mockDate.mockReturnValue(startTime);

      const userId = 'user-123';
      const organizationId = 'org-456';

      mockUsersAdapter.getUserAndAllOrganizations.mockResolvedValue({
        user: { id: userId, name: 'Test User', email: 'test@example.com', state: 'Active' },
        userInOrganizations: [
          { userId, organizationId, role: UserRole.Admin }
        ]
      });

      // First call to populate cache
      await dynamicAuthService.validateUserOrganizationPermission(userId, organizationId);

      // Advance time beyond cache expiry (2 minutes + 1ms)
      mockDate.mockReturnValue(startTime + 2 * 60 * 1000 + 1);

      // Next call should hit the database again due to expired cache
      await dynamicAuthService.validateUserOrganizationPermission(userId, organizationId);

      expect(mockUsersAdapter.getUserAndAllOrganizations).toHaveBeenCalledTimes(2);

      mockDate.mockRestore();
    });
  });
});