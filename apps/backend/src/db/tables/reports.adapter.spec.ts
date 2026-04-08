import { ReportsAdapter } from './reports.adapter';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  },
  QueryCommand: jest.fn().mockImplementation((params) => params),
  PutCommand: jest.fn(),
  BatchWriteCommand: jest.fn(),
}));

jest.mock('../../services/aws-client-config.service', () => ({
  getDynamoDbClientConfig: jest.fn().mockReturnValue({}),
}));

describe('ReportsAdapter', () => {
  let adapter: ReportsAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ReportsAdapter();
  });

  describe('getReportsByDates', () => {
    it('returns reports for dates that have items', async () => {
      const mockItems = [
        { productId: 'prod-1', upi: 'upi-1', location: 'Room A' },
      ];
      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await adapter.getReportsByDates('org-1', ['2026-04-08']);

      expect(result).toEqual({ '2026-04-08': mockItems });
    });

    it('returns empty array for dates with no items (Items is undefined)', async () => {
      mockSend.mockResolvedValue({ Items: undefined });

      const result = await adapter.getReportsByDates('org-1', ['2026-04-08']);

      expect(result).toEqual({ '2026-04-08': [] });
    });

    it('returns empty array for dates with no items (Items is null)', async () => {
      mockSend.mockResolvedValue({ Items: null });

      const result = await adapter.getReportsByDates('org-1', ['2026-04-08']);

      expect(result).toEqual({ '2026-04-08': [] });
    });

    it('returns empty array for dates when response has no Items property', async () => {
      mockSend.mockResolvedValue({});

      const result = await adapter.getReportsByDates('org-1', ['2026-04-08']);

      expect(result).toEqual({ '2026-04-08': [] });
    });

    it('handles mixed dates — some with items, some without', async () => {
      const mockItems = [
        { productId: 'prod-1', upi: 'upi-1', location: 'Room A' },
      ];
      mockSend
        .mockResolvedValueOnce({ Items: mockItems })
        .mockResolvedValueOnce({ Items: undefined })
        .mockResolvedValueOnce({ Items: [{ productId: 'prod-2', upi: 'upi-2', location: 'Room B' }] });

      const result = await adapter.getReportsByDates('org-1', [
        '2026-04-06',
        '2026-04-07',
        '2026-04-08',
      ]);

      expect(result['2026-04-06']).toEqual(mockItems);
      expect(result['2026-04-07']).toEqual([]);
      expect(result['2026-04-08']).toHaveLength(1);
    });

    it('handles empty dates array', async () => {
      const result = await adapter.getReportsByDates('org-1', []);

      expect(result).toEqual({});
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('handles single date with items', async () => {
      const mockItems = [
        { productId: 'prod-1', upi: 'upi-1', location: 'Room A' },
        { productId: 'prod-2', upi: 'upi-2', location: 'Room B' },
      ];
      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await adapter.getReportsByDates('org-1', ['2026-04-08']);

      expect(result['2026-04-08']).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
