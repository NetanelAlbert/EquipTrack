import { handler } from './publish';
import { UserRole } from '@equip-track/shared';

const mockPublishPartialReport = jest.fn();
const mockGetHolderIdByProductUpi = jest.fn();
const mockGetUserInOrganization = jest.fn();

jest.mock('../../../db/tables/reports.adapter', () => ({
  ReportsAdapter: jest.fn().mockImplementation(() => ({
    publishPartialReport: mockPublishPartialReport,
  })),
}));

jest.mock('../../../db/tables/inventory.adapter', () => ({
  InventoryAdapter: jest.fn().mockImplementation(() => ({
    getHolderIdByProductUpi: mockGetHolderIdByProductUpi,
  })),
}));

jest.mock('../../../db/tables/users-and-organizations.adapter', () => ({
  UsersAndOrganizationsAdapter: jest.fn().mockImplementation(() => ({
    getUserInOrganization: mockGetUserInOrganization,
  })),
}));

describe('publish partial report handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHolderIdByProductUpi.mockResolvedValue(
      new Map([['prod-1\u001fupi-1', 'user-1']])
    );
    mockGetUserInOrganization.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
      role: UserRole.Customer,
      department: {
        id: 'dep-1',
        roleDescription: '',
        subDepartmentId: 'sub-1',
      },
    });
    mockPublishPartialReport.mockResolvedValue(1);
  });

  it('adds reportTimestamp to every published item', async () => {
    const response = await handler(
      {
        items: [{ productId: 'prod-1', upi: 'upi-1', location: 'Room A' }],
      },
      { organizationId: 'org-1' },
      {
        sub: 'reporter-1',
        orgIdToRole: { 'org-1': UserRole.Admin },
        iat: 1,
        exp: 2,
      }
    );

    expect(response.status).toBe(true);
    expect(response.items).toHaveLength(1);
    expect(response.items[0].reportTimestamp).toBeDefined();
    expect(new Date(response.items[0].reportTimestamp || '').toISOString()).toBe(
      response.items[0].reportTimestamp
    );

    expect(mockPublishPartialReport).toHaveBeenCalledTimes(1);
    const callArgs = mockPublishPartialReport.mock.calls[0];
    expect(callArgs[0]).toBe('org-1');
    expect(callArgs[2][0].reportTimestamp).toBe(response.items[0].reportTimestamp);
  });
});
