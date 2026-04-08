import { handler } from './get-by-dates';

const mockGetReportsByDates = jest.fn();

jest.mock('../../../db/tables/reports.adapter', () => ({
  ReportsAdapter: jest.fn().mockImplementation(() => ({
    getReportsByDates: mockGetReportsByDates,
  })),
}));

describe('get-by-dates handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns reports for valid dates', async () => {
    const mockReports = {
      '2026-04-08': [{ productId: 'prod-1', upi: 'upi-1', location: 'Room A' }],
    };
    mockGetReportsByDates.mockResolvedValue(mockReports);

    const result = await handler(
      { dates: ['2026-04-08'] },
      { organizationId: 'org-1' }
    );

    expect(result.status).toBe(true);
    expect(result.reportsByDate).toEqual(mockReports);
    expect(mockGetReportsByDates).toHaveBeenCalledWith('org-1', ['2026-04-08']);
  });

  it('returns empty arrays for dates with no reports', async () => {
    mockGetReportsByDates.mockResolvedValue({
      '2026-04-07': [],
      '2026-04-08': [],
    });

    const result = await handler(
      { dates: ['2026-04-07', '2026-04-08'] },
      { organizationId: 'org-1' }
    );

    expect(result.status).toBe(true);
    expect(result.reportsByDate['2026-04-07']).toEqual([]);
    expect(result.reportsByDate['2026-04-08']).toEqual([]);
  });

  it('throws when organization ID is missing', async () => {
    await expect(handler({ dates: ['2026-04-08'] }, {})).rejects.toThrow(
      'Organization ID is required'
    );
  });

  it('throws when dates array is empty', async () => {
    await expect(
      handler({ dates: [] }, { organizationId: 'org-1' })
    ).rejects.toThrow('Dates array is required and must not be empty');
  });

  it('throws when dates array is missing', async () => {
    await expect(
      handler({ dates: undefined as unknown as string[] }, { organizationId: 'org-1' })
    ).rejects.toThrow('Dates array is required and must not be empty');
  });

  it('throws when dates contain invalid values', async () => {
    await expect(
      handler({ dates: ['not-a-date'] }, { organizationId: 'org-1' })
    ).rejects.toThrow('Invalid dates');
  });

  it('handles adapter errors gracefully', async () => {
    mockGetReportsByDates.mockRejectedValue(new Error('DynamoDB failure'));

    await expect(
      handler({ dates: ['2026-04-08'] }, { organizationId: 'org-1' })
    ).rejects.toThrow('Failed to get reports by dates');
  });
});
