import { JwtPayload, UserRole, UserInOrganization } from '@equip-track/shared';

const mockGenerateToken = jest.fn();
const mockGetUserAndAllOrganizations = jest.fn();
const mockGetOrganizations = jest.fn();

jest.mock('../services/jwt.service', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    generateToken: mockGenerateToken,
  })),
}));

jest.mock('../db', () => ({
  UsersAndOrganizationsAdapter: jest.fn().mockImplementation(() => ({
    getUserAndAllOrganizations: mockGetUserAndAllOrganizations,
    getOrganizations: mockGetOrganizations,
  })),
}));

import { handler, buildOrgIdToRole, hasPermissionsChanged } from './start';

describe('start handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return refreshedToken when JWT permissions differ from DB', async () => {
    const jwtPayload: JwtPayload = {
      sub: 'user-1',
      orgIdToRole: {},
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    mockGetUserAndAllOrganizations.mockResolvedValue({
      user: { id: 'user-1', email: 'a@b.com', name: 'Test', state: 'active' },
      userInOrganizations: [
        { userId: 'user-1', organizationId: 'org-1', role: UserRole.Admin },
      ],
    });
    mockGetOrganizations.mockResolvedValue([{ id: 'org-1', name: 'Org' }]);
    mockGenerateToken.mockResolvedValue('new-jwt-token');

    const result = await handler(undefined, {}, jwtPayload);

    expect(result.refreshedToken).toBe('new-jwt-token');
    expect(mockGenerateToken).toHaveBeenCalledWith('user-1', {
      'org-1': UserRole.Admin,
    });
  });

  it('should not return refreshedToken when JWT permissions match DB', async () => {
    const jwtPayload: JwtPayload = {
      sub: 'user-1',
      orgIdToRole: { 'org-1': UserRole.Admin },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    mockGetUserAndAllOrganizations.mockResolvedValue({
      user: { id: 'user-1', email: 'a@b.com', name: 'Test', state: 'active' },
      userInOrganizations: [
        { userId: 'user-1', organizationId: 'org-1', role: UserRole.Admin },
      ],
    });
    mockGetOrganizations.mockResolvedValue([{ id: 'org-1', name: 'Org' }]);

    const result = await handler(undefined, {}, jwtPayload);

    expect(result.refreshedToken).toBeUndefined();
    expect(mockGenerateToken).not.toHaveBeenCalled();
  });

  it('should return refreshedToken when user role changed', async () => {
    const jwtPayload: JwtPayload = {
      sub: 'user-1',
      orgIdToRole: { 'org-1': UserRole.Customer },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    mockGetUserAndAllOrganizations.mockResolvedValue({
      user: { id: 'user-1', email: 'a@b.com', name: 'Test', state: 'active' },
      userInOrganizations: [
        { userId: 'user-1', organizationId: 'org-1', role: UserRole.Admin },
      ],
    });
    mockGetOrganizations.mockResolvedValue([{ id: 'org-1', name: 'Org' }]);
    mockGenerateToken.mockResolvedValue('updated-role-token');

    const result = await handler(undefined, {}, jwtPayload);

    expect(result.refreshedToken).toBe('updated-role-token');
    expect(mockGenerateToken).toHaveBeenCalledWith('user-1', {
      'org-1': UserRole.Admin,
    });
  });

  it('should return refreshedToken when user removed from an org', async () => {
    const jwtPayload: JwtPayload = {
      sub: 'user-1',
      orgIdToRole: { 'org-1': UserRole.Admin, 'org-2': UserRole.Customer },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    mockGetUserAndAllOrganizations.mockResolvedValue({
      user: { id: 'user-1', email: 'a@b.com', name: 'Test', state: 'active' },
      userInOrganizations: [
        { userId: 'user-1', organizationId: 'org-1', role: UserRole.Admin },
      ],
    });
    mockGetOrganizations.mockResolvedValue([{ id: 'org-1', name: 'Org' }]);
    mockGenerateToken.mockResolvedValue('removed-org-token');

    const result = await handler(undefined, {}, jwtPayload);

    expect(result.refreshedToken).toBe('removed-org-token');
    expect(mockGenerateToken).toHaveBeenCalledWith('user-1', {
      'org-1': UserRole.Admin,
    });
  });
});

describe('buildOrgIdToRole', () => {
  it('should build orgIdToRole map from user organizations', () => {
    const orgs: UserInOrganization[] = [
      { userId: 'u1', organizationId: 'org-1', role: UserRole.Admin },
      { userId: 'u1', organizationId: 'org-2', role: UserRole.Customer },
    ];

    const result = buildOrgIdToRole(orgs);

    expect(result).toEqual({
      'org-1': UserRole.Admin,
      'org-2': UserRole.Customer,
    });
  });

  it('should return empty object for empty organizations', () => {
    expect(buildOrgIdToRole([])).toEqual({});
  });
});

describe('hasPermissionsChanged', () => {
  it('should return false for identical permissions', () => {
    const a = { 'org-1': UserRole.Admin as UserRole };
    const b = { 'org-1': UserRole.Admin as UserRole };
    expect(hasPermissionsChanged(a, b)).toBe(false);
  });

  it('should return true when org added', () => {
    const jwt = {} as Record<string, UserRole>;
    const db = { 'org-1': UserRole.Admin as UserRole };
    expect(hasPermissionsChanged(jwt, db)).toBe(true);
  });

  it('should return true when org removed', () => {
    const jwt = { 'org-1': UserRole.Admin as UserRole };
    const db = {} as Record<string, UserRole>;
    expect(hasPermissionsChanged(jwt, db)).toBe(true);
  });

  it('should return true when role changed', () => {
    const jwt = { 'org-1': UserRole.Customer as UserRole };
    const db = { 'org-1': UserRole.Admin as UserRole };
    expect(hasPermissionsChanged(jwt, db)).toBe(true);
  });

  it('should return false for multiple identical orgs', () => {
    const a = {
      'org-1': UserRole.Admin as UserRole,
      'org-2': UserRole.Customer as UserRole,
    };
    const b = {
      'org-1': UserRole.Admin as UserRole,
      'org-2': UserRole.Customer as UserRole,
    };
    expect(hasPermissionsChanged(a, b)).toBe(false);
  });

  it('should return true when different org set', () => {
    const a = { 'org-1': UserRole.Admin as UserRole };
    const b = { 'org-2': UserRole.Admin as UserRole };
    expect(hasPermissionsChanged(a, b)).toBe(true);
  });
});
