import { handler } from './get-ownership-history';

const mockGetUniqueInventoryItem = jest.fn();

jest.mock('../../../db/tables/inventory.adapter', () => ({
  InventoryAdapter: jest.fn().mockImplementation(() => ({
    getUniqueInventoryItem: mockGetUniqueInventoryItem,
  })),
}));

describe('get-ownership-history handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ownership history newest-first', async () => {
    const older = {
      previousHolderId: 'WAREHOUSE',
      newHolderId: 'user-a',
      timestamp: 100,
      formId: 'f1',
      formType: 'check-out' as const,
    };
    const newer = {
      previousHolderId: 'user-a',
      newHolderId: 'WAREHOUSE',
      timestamp: 200,
      formId: 'f2',
      formType: 'check-in' as const,
    };
    mockGetUniqueInventoryItem.mockResolvedValue({
      ownershipHistory: [older, newer],
    });

    const response = await handler(
      { productId: 'prod-1', upi: 'upi-1' },
      { organizationId: 'org-1' }
    );

    expect(response.status).toBe(true);
    expect(response.ownershipHistory).toEqual([newer, older]);
    expect(mockGetUniqueInventoryItem).toHaveBeenCalledWith(
      'prod-1',
      'upi-1',
      'org-1'
    );
  });

  it('returns empty array when item has no history', async () => {
    mockGetUniqueInventoryItem.mockResolvedValue({});

    const response = await handler(
      { productId: 'prod-1', upi: 'upi-1' },
      { organizationId: 'org-1' }
    );

    expect(response.status).toBe(true);
    expect(response.ownershipHistory).toEqual([]);
  });

  it('throws when organizationId is missing', async () => {
    await expect(
      handler({ productId: 'prod-1', upi: 'upi-1' }, {})
    ).rejects.toThrow('Organization ID is required');
  });

  it('throws when adapter fails', async () => {
    mockGetUniqueInventoryItem.mockRejectedValue(new Error('DB error'));

    await expect(
      handler(
        { productId: 'prod-1', upi: 'upi-1' },
        { organizationId: 'org-1' }
      )
    ).rejects.toThrow('Failed to get item ownership history');
  });
});
