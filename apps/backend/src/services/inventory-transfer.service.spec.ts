import {
  FormStatus,
  FormType,
  InventoryForm,
  InventoryItem,
} from '@equip-track/shared';
import { WAREHOUSE_SUFFIX } from '../db/constants';
import { InventoryTransferService } from './inventory-transfer.service';

type InventoryLockCallback = () => Promise<unknown>;

interface MockInventoryAdapter {
  withInventoryLock: jest.Mock<Promise<unknown>, [string, InventoryLockCallback]>;
  getUserInventory: jest.Mock<Promise<InventoryItem[]>, [string, string]>;
  updateUniqueInventoryItemHolder: jest.Mock<
    Promise<void>,
    [string, string, string, string]
  >;
  deleteBulkInventoryItem: jest.Mock<Promise<void>, [string, string, string]>;
  updateInventoryItemQuantity: jest.Mock<
    Promise<void>,
    [string, string, string, number]
  >;
  createBulkInventoryItem: jest.Mock<
    Promise<void>,
    [string, string, string, number]
  >;
}

const mockInventoryAdapter: MockInventoryAdapter = {
  withInventoryLock: jest.fn(),
  getUserInventory: jest.fn(),
  updateUniqueInventoryItemHolder: jest.fn(),
  deleteBulkInventoryItem: jest.fn(),
  updateInventoryItemQuantity: jest.fn(),
  createBulkInventoryItem: jest.fn(),
};

jest.mock('../db/tables/inventory.adapter', () => ({
  InventoryAdapter: jest.fn(() => mockInventoryAdapter),
}));

function buildForm(overrides: Partial<InventoryForm>): InventoryForm {
  return {
    userID: 'user-1',
    formID: 'form-1',
    organizationID: 'org-1',
    items: [],
    type: FormType.CheckOut,
    status: FormStatus.Pending,
    createdAtTimestamp: 0,
    lastUpdated: 0,
    ...overrides,
  };
}

describe('InventoryTransferService', () => {
  let service: InventoryTransferService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInventoryAdapter.withInventoryLock.mockImplementation(
      async (_organizationId, callback) => callback()
    );
    mockInventoryAdapter.getUserInventory.mockResolvedValue([]);
    mockInventoryAdapter.updateUniqueInventoryItemHolder.mockResolvedValue();
    mockInventoryAdapter.deleteBulkInventoryItem.mockResolvedValue();
    mockInventoryAdapter.updateInventoryItemQuantity.mockResolvedValue();
    mockInventoryAdapter.createBulkInventoryItem.mockResolvedValue();

    service = new InventoryTransferService();
  });

  it('transfers checkout bulk quantities using matching product IDs', async () => {
    const organizationId = 'org-1';
    const form = buildForm({
      userID: 'user-1',
      type: FormType.CheckOut,
      items: [{ productId: 'prod-b', quantity: 2 }],
    });

    const sourceInventory: InventoryItem[] = [
      { productId: 'prod-a', quantity: 99 },
      { productId: 'prod-b', quantity: 10 },
    ];
    const destinationInventory: InventoryItem[] = [
      { productId: 'prod-a', quantity: 5 },
      { productId: 'prod-b', quantity: 1 },
    ];

    mockInventoryAdapter.getUserInventory
      .mockResolvedValueOnce(sourceInventory) // Validation source holder
      .mockResolvedValueOnce(sourceInventory) // Transfer source holder
      .mockResolvedValueOnce(destinationInventory); // Transfer destination holder

    await service.transferInventoryItems(form, organizationId);

    expect(mockInventoryAdapter.withInventoryLock).toHaveBeenCalledWith(
      organizationId,
      expect.any(Function)
    );
    expect(mockInventoryAdapter.updateInventoryItemQuantity).toHaveBeenCalledTimes(
      2
    );
    expect(mockInventoryAdapter.updateInventoryItemQuantity).toHaveBeenNthCalledWith(
      1,
      'prod-b',
      organizationId,
      WAREHOUSE_SUFFIX,
      8
    );
    expect(mockInventoryAdapter.updateInventoryItemQuantity).toHaveBeenNthCalledWith(
      2,
      'prod-b',
      organizationId,
      'user-1',
      3
    );
    expect(mockInventoryAdapter.createBulkInventoryItem).not.toHaveBeenCalled();
    expect(mockInventoryAdapter.deleteBulkInventoryItem).not.toHaveBeenCalled();
  });

  it('creates destination bulk inventory for check-in when destination product is absent', async () => {
    const organizationId = 'org-1';
    const form = buildForm({
      userID: 'user-7',
      type: FormType.CheckIn,
      items: [{ productId: 'prod-c', quantity: 2 }],
    });

    const sourceUserInventory: InventoryItem[] = [
      { productId: 'prod-x', quantity: 1 },
      { productId: 'prod-c', quantity: 2 },
    ];
    const destinationWarehouseInventory: InventoryItem[] = [
      { productId: 'prod-z', quantity: 100 },
    ];

    mockInventoryAdapter.getUserInventory
      .mockResolvedValueOnce(sourceUserInventory) // Validation source holder
      .mockResolvedValueOnce(sourceUserInventory) // Transfer source holder
      .mockResolvedValueOnce(destinationWarehouseInventory); // Transfer destination holder

    await service.transferInventoryItems(form, organizationId);

    expect(mockInventoryAdapter.deleteBulkInventoryItem).toHaveBeenCalledWith(
      'prod-c',
      organizationId,
      'user-7'
    );
    expect(mockInventoryAdapter.createBulkInventoryItem).toHaveBeenCalledWith(
      'prod-c',
      organizationId,
      WAREHOUSE_SUFFIX,
      2
    );
    expect(mockInventoryAdapter.updateInventoryItemQuantity).not.toHaveBeenCalled();
  });
});
