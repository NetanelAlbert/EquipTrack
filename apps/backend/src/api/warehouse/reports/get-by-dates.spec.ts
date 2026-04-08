import { handler } from './get-by-dates';
import { UserRole } from '@equip-track/shared';

const mockGetReportsByDates = jest.fn();
const mockGetUsersByOrganization = jest.fn();

jest.mock('../../../db/tables/reports.adapter', () => ({
  ReportsAdapter: jest.fn().mockImplementation(() => ({
    getReportsByDates: mockGetReportsByDates,
  })),
}));

jest.mock('../../../db', () => ({
  UsersAndOrganizationsAdapter: jest.fn().mockImplementation(() => ({
    getUsersByOrganization: mockGetUsersByOrganization,
  })),
}));

const ORG_ID = 'org-1';
const CUSTOMER_USER_ID = 'customer-1';
const SAME_DEPT_USER_ID = 'same-dept-user';
const OTHER_DEPT_USER_ID = 'other-dept-user';

const makeReport = (ownerUserId: string, productId = 'prod-1', upi = 'upi-1') => ({
  orgDailyReportId: `ORG#${ORG_ID}#DATE#2025-01-15`,
  itemKey: `PRODUCT#${productId}#UPI#${upi}`,
  itemOrgKey: '',
  reportDate: '2025-01-15',
  productId,
  upi,
  location: 'Room A',
  reportedBy: 'reporter-1',
  ownerUserId,
});

const orgUsers = [
  {
    user: { id: CUSTOMER_USER_ID, name: 'Customer' },
    userInOrganization: {
      organizationId: ORG_ID,
      userId: CUSTOMER_USER_ID,
      role: UserRole.Customer,
      department: { id: 'dep-1', roleDescription: '', subDepartmentId: 'sub-1' },
    },
  },
  {
    user: { id: SAME_DEPT_USER_ID, name: 'Same Dept' },
    userInOrganization: {
      organizationId: ORG_ID,
      userId: SAME_DEPT_USER_ID,
      role: UserRole.Customer,
      department: { id: 'dep-1', roleDescription: '', subDepartmentId: 'sub-1' },
    },
  },
  {
    user: { id: OTHER_DEPT_USER_ID, name: 'Other Dept' },
    userInOrganization: {
      organizationId: ORG_ID,
      userId: OTHER_DEPT_USER_ID,
      role: UserRole.Customer,
      department: { id: 'dep-2', roleDescription: '', subDepartmentId: 'sub-2' },
    },
  },
];

describe('getReportsByDates handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUsersByOrganization.mockResolvedValue(orgUsers);
  });

  it('returns all reports for admin users', async () => {
    const reports = {
      '2025-01-15': [
        makeReport(CUSTOMER_USER_ID, 'p1', 'u1'),
        makeReport(OTHER_DEPT_USER_ID, 'p2', 'u2'),
      ],
    };
    mockGetReportsByDates.mockResolvedValue(reports);

    const result = await handler(
      { dates: ['2025-01-15'] },
      { organizationId: ORG_ID },
      { sub: 'admin-user', orgIdToRole: { [ORG_ID]: UserRole.Admin }, iat: 1, exp: 2 }
    );

    expect(result.status).toBe(true);
    expect(result.reportsByDate['2025-01-15']).toHaveLength(2);
    expect(mockGetUsersByOrganization).not.toHaveBeenCalled();
  });

  it('returns all reports for warehouse-manager users', async () => {
    const reports = {
      '2025-01-15': [
        makeReport(CUSTOMER_USER_ID, 'p1', 'u1'),
        makeReport(OTHER_DEPT_USER_ID, 'p2', 'u2'),
      ],
    };
    mockGetReportsByDates.mockResolvedValue(reports);

    const result = await handler(
      { dates: ['2025-01-15'] },
      { organizationId: ORG_ID },
      { sub: 'wh-user', orgIdToRole: { [ORG_ID]: UserRole.WarehouseManager }, iat: 1, exp: 2 }
    );

    expect(result.status).toBe(true);
    expect(result.reportsByDate['2025-01-15']).toHaveLength(2);
    expect(mockGetUsersByOrganization).not.toHaveBeenCalled();
  });

  it('filters reports for customer to only same sub-department items', async () => {
    const reports = {
      '2025-01-15': [
        makeReport(CUSTOMER_USER_ID, 'p1', 'u1'),
        makeReport(SAME_DEPT_USER_ID, 'p2', 'u2'),
        makeReport(OTHER_DEPT_USER_ID, 'p3', 'u3'),
      ],
    };
    mockGetReportsByDates.mockResolvedValue(reports);

    const result = await handler(
      { dates: ['2025-01-15'] },
      { organizationId: ORG_ID },
      { sub: CUSTOMER_USER_ID, orgIdToRole: { [ORG_ID]: UserRole.Customer }, iat: 1, exp: 2 }
    );

    expect(result.status).toBe(true);
    const filteredReports = result.reportsByDate['2025-01-15'];
    expect(filteredReports).toHaveLength(2);
    expect(filteredReports.map((r) => r.ownerUserId)).toEqual(
      expect.arrayContaining([CUSTOMER_USER_ID, SAME_DEPT_USER_ID])
    );
    expect(filteredReports.map((r) => r.ownerUserId)).not.toContain(OTHER_DEPT_USER_ID);
    expect(mockGetUsersByOrganization).toHaveBeenCalledWith(ORG_ID);
  });

  it('keeps reports with no ownerUserId for customer users', async () => {
    const reportNoOwner = makeReport('', 'p1', 'u1');
    delete (reportNoOwner as Record<string, unknown>)['ownerUserId'];
    const reports = {
      '2025-01-15': [
        reportNoOwner,
        makeReport(OTHER_DEPT_USER_ID, 'p2', 'u2'),
      ],
    };
    mockGetReportsByDates.mockResolvedValue(reports);

    const result = await handler(
      { dates: ['2025-01-15'] },
      { organizationId: ORG_ID },
      { sub: CUSTOMER_USER_ID, orgIdToRole: { [ORG_ID]: UserRole.Customer }, iat: 1, exp: 2 }
    );

    expect(result.reportsByDate['2025-01-15']).toHaveLength(1);
    expect(result.reportsByDate['2025-01-15'][0].productId).toBe('p1');
  });

  it('filters across multiple dates for customer users', async () => {
    const reports = {
      '2025-01-15': [
        makeReport(CUSTOMER_USER_ID, 'p1', 'u1'),
        makeReport(OTHER_DEPT_USER_ID, 'p2', 'u2'),
      ],
      '2025-01-16': [
        makeReport(SAME_DEPT_USER_ID, 'p3', 'u3'),
        makeReport(OTHER_DEPT_USER_ID, 'p4', 'u4'),
      ],
    };
    mockGetReportsByDates.mockResolvedValue(reports);

    const result = await handler(
      { dates: ['2025-01-15', '2025-01-16'] },
      { organizationId: ORG_ID },
      { sub: CUSTOMER_USER_ID, orgIdToRole: { [ORG_ID]: UserRole.Customer }, iat: 1, exp: 2 }
    );

    expect(result.reportsByDate['2025-01-15']).toHaveLength(1);
    expect(result.reportsByDate['2025-01-15'][0].ownerUserId).toBe(CUSTOMER_USER_ID);
    expect(result.reportsByDate['2025-01-16']).toHaveLength(1);
    expect(result.reportsByDate['2025-01-16'][0].ownerUserId).toBe(SAME_DEPT_USER_ID);
  });

  it('throws on missing organization ID', async () => {
    await expect(
      handler({ dates: ['2025-01-15'] }, {})
    ).rejects.toThrow('Organization ID is required');
  });

  it('throws on empty dates array', async () => {
    await expect(
      handler({ dates: [] }, { organizationId: ORG_ID })
    ).rejects.toThrow('Dates array is required and must not be empty');
  });

  it('throws on invalid dates', async () => {
    await expect(
      handler({ dates: ['not-a-date'] }, { organizationId: ORG_ID })
    ).rejects.toThrow('Invalid dates: not-a-date');
  });
});
