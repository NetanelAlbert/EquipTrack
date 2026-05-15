import { handler } from './get-item-history';

const mockGetItemHistory = jest.fn();

jest.mock('../../../db/tables/reports.adapter', () => ({
  ReportsAdapter: jest.fn().mockImplementation(() => ({
    getItemHistory: mockGetItemHistory,
  })),
}));

describe('get-item-history handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns report history for a valid item', async () => {
    const mockReports = [
      {
        productId: 'prod-1',
        upi: 'upi-1',
        location: 'Room A',
        reportedBy: 'user-1',
        reportDate: '2026-04-01',
        reportTimestamp: '2026-04-01T10:00:00.000Z',
        ownerUserId: 'user-2',
        departmentId: 'dep-1',
      },
      {
        productId: 'prod-1',
        upi: 'upi-1',
        location: 'Room B',
        reportedBy: 'user-3',
        reportDate: '2026-03-31',
        reportTimestamp: '2026-03-31T09:00:00.000Z',
        ownerUserId: 'user-2',
        departmentId: 'dep-1',
      },
    ];
    mockGetItemHistory.mockResolvedValue(mockReports);

    const response = await handler(
      { productId: 'prod-1', upi: 'upi-1' },
      { organizationId: 'org-1' }
    );

    expect(response.status).toBe(true);
    expect(response.reports).toHaveLength(2);
    expect(response.reports[0].reportDate).toBe('2026-04-01');
    expect(response.reports[1].reportDate).toBe('2026-03-31');
    expect(mockGetItemHistory).toHaveBeenCalledWith('org-1', 'prod-1', 'upi-1');
  });

  it('returns empty array when no reports found', async () => {
    mockGetItemHistory.mockResolvedValue([]);

    const response = await handler(
      { productId: 'prod-1', upi: 'upi-1' },
      { organizationId: 'org-1' }
    );

    expect(response.status).toBe(true);
    expect(response.reports).toHaveLength(0);
  });

  it('throws when organizationId is missing', async () => {
    await expect(
      handler({ productId: 'prod-1', upi: 'upi-1' }, {})
    ).rejects.toThrow('Organization ID is required');
  });

  it('throws when productId is missing', async () => {
    await expect(
      handler({ productId: '', upi: 'upi-1' }, { organizationId: 'org-1' })
    ).rejects.toThrow('Product ID and UPI are required');
  });

  it('throws when upi is missing', async () => {
    await expect(
      handler({ productId: 'prod-1', upi: '' }, { organizationId: 'org-1' })
    ).rejects.toThrow('Product ID and UPI are required');
  });

  it('throws when adapter fails', async () => {
    mockGetItemHistory.mockRejectedValue(new Error('DB error'));

    await expect(
      handler(
        { productId: 'prod-1', upi: 'upi-1' },
        { organizationId: 'org-1' }
      )
    ).rejects.toThrow('Failed to get item report history');
  });
});
