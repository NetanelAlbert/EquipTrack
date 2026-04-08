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

  it('returns 400 when organizationId is missing', async () => {
    await expect(
      handler({ dates: ['2026-04-08'] }, {})
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns 400 when dates array is empty', async () => {
    await expect(
      handler({ dates: [] }, { organizationId: 'org-1' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns 400 when dates are invalid', async () => {
    await expect(
      handler({ dates: ['not-a-date'] }, { organizationId: 'org-1' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns success with valid dates', async () => {
    mockGetReportsByDates.mockResolvedValue({ '2026-04-08': [] });

    const result = await handler(
      { dates: ['2026-04-08'] },
      { organizationId: 'org-1' }
    );

    expect(result.status).toBe(true);
    expect(result.reportsByDate).toBeDefined();
  });

  it('returns 500 when database fails', async () => {
    mockGetReportsByDates.mockRejectedValue(new Error('DB error'));

    await expect(
      handler({ dates: ['2026-04-08'] }, { organizationId: 'org-1' })
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});
