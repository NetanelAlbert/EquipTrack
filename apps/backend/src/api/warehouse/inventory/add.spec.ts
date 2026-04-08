import { ErrorKeys } from '@equip-track/shared';

const mockGetUserInventory = jest.fn();
const mockCreateUniqueInventoryItem = jest.fn();
const mockCreateBulkInventoryItem = jest.fn();
const mockUpdateInventoryItemQuantity = jest.fn();
const mockWithInventoryLock = jest.fn(
  (_orgId: string, fn: () => Promise<void>) => fn()
);

jest.mock('../../../db', () => ({
  InventoryAdapter: jest.fn().mockImplementation(() => ({
    getUserInventory: mockGetUserInventory,
    createUniqueInventoryItem: mockCreateUniqueInventoryItem,
    createBulkInventoryItem: mockCreateBulkInventoryItem,
    updateInventoryItemQuantity: mockUpdateInventoryItemQuantity,
    withInventoryLock: mockWithInventoryLock,
  })),
}));

import { handler } from './add';

describe('add inventory handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserInventory.mockResolvedValue([]);
  });

  it('returns success when adding valid UPI items', async () => {
    const result = await handler(
      { items: [{ productId: 'prod-1', quantity: 1, upis: ['UPI-001'] }] },
      { organizationId: 'org-1' }
    );

    expect(result).toEqual({ status: true });
    expect(mockCreateUniqueInventoryItem).toHaveBeenCalledWith(
      'prod-1',
      'UPI-001',
      'org-1',
      'WAREHOUSE'
    );
  });

  it('throws ErrorResponse with INVENTORY_DUPLICATE_UPI when UPI already exists', async () => {
    mockGetUserInventory.mockResolvedValue([
      { productId: 'prod-1', quantity: 1, upis: ['UPI-001'] },
    ]);

    try {
      await handler(
        { items: [{ productId: 'prod-1', quantity: 1, upis: ['UPI-001'] }] },
        { organizationId: 'org-1' }
      );
      fail('Expected handler to throw');
    } catch (error: unknown) {
      const err = error as { statusCode: number; body: string };
      expect(err.statusCode).toBe(400);
      const body = JSON.parse(err.body);
      expect(body.errorKey).toBe(ErrorKeys.INVENTORY_DUPLICATE_UPI);
      expect(body.errorMessage).toContain('UPI already exists');
      expect(body.errorMessage).toContain('UPI-001');
    }
  });

  it('lists all duplicate UPIs in the error message', async () => {
    mockGetUserInventory.mockResolvedValue([
      { productId: 'prod-1', quantity: 2, upis: ['UPI-A', 'UPI-B'] },
    ]);

    try {
      await handler(
        {
          items: [
            {
              productId: 'prod-1',
              quantity: 2,
              upis: ['UPI-A', 'UPI-B'],
            },
          ],
        },
        { organizationId: 'org-1' }
      );
      fail('Expected handler to throw');
    } catch (error: unknown) {
      const err = error as { statusCode: number; body: string };
      const body = JSON.parse(err.body);
      expect(body.errorMessage).toContain('UPI-A');
      expect(body.errorMessage).toContain('UPI-B');
    }
  });

  it('merges quantities for bulk items without error', async () => {
    mockGetUserInventory.mockResolvedValue([
      { productId: 'prod-bulk', quantity: 5 },
    ]);

    const result = await handler(
      { items: [{ productId: 'prod-bulk', quantity: 3 }] },
      { organizationId: 'org-1' }
    );

    expect(result).toEqual({ status: true });
    expect(mockUpdateInventoryItemQuantity).toHaveBeenCalledWith(
      'prod-bulk',
      'org-1',
      'WAREHOUSE',
      8
    );
  });
});
