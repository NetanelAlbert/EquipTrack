import { getCustomerDepartmentScope } from './customer-department-scope';
import { UserRole } from '@equip-track/shared';

const mockGetUsersByOrganization = jest.fn();

jest.mock('../../../db', () => ({
  UsersAndOrganizationsAdapter: jest.fn().mockImplementation(() => ({
    getUsersByOrganization: mockGetUsersByOrganization,
  })),
}));

const ORG_ID = 'org-1';

const makeUser = (
  id: string,
  deptId: string,
  subDeptId: string,
  role = UserRole.Customer
) => ({
  user: { id, name: id },
  userInOrganization: {
    organizationId: ORG_ID,
    userId: id,
    role,
    department: { id: deptId, roleDescription: '', subDepartmentId: subDeptId },
  },
});

describe('getCustomerDepartmentScope', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the user and same sub-department members', async () => {
    mockGetUsersByOrganization.mockResolvedValue([
      makeUser('u1', 'dep-a', 'sub-1'),
      makeUser('u2', 'dep-a', 'sub-1'),
      makeUser('u3', 'dep-a', 'sub-2'),
      makeUser('u4', 'dep-b', 'sub-3'),
    ]);

    const scope = await getCustomerDepartmentScope('u1', ORG_ID);

    expect(scope).toEqual(new Set(['u1', 'u2']));
  });

  it('always includes the requesting user even when not found in org', async () => {
    mockGetUsersByOrganization.mockResolvedValue([]);

    const scope = await getCustomerDepartmentScope('unknown', ORG_ID);

    expect(scope).toEqual(new Set(['unknown']));
  });

  it('returns only the user when they have no department', async () => {
    mockGetUsersByOrganization.mockResolvedValue([
      {
        user: { id: 'u1', name: 'u1' },
        userInOrganization: {
          organizationId: ORG_ID,
          userId: 'u1',
          role: UserRole.Customer,
        },
      },
      makeUser('u2', 'dep-a', 'sub-1'),
    ]);

    const scope = await getCustomerDepartmentScope('u1', ORG_ID);

    expect(scope).toEqual(new Set(['u1']));
  });
});
