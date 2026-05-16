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
    [string, string, string, string, unknown?]
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

  it('creates new destination bulk inventory when product absent at warehouse', async () => {
    const organizationId = 'org-1';
    const form = buildForm({
      userID: 'user-2',
      type: FormType.CheckOut,
      items: [{ productId: 'prod-c', quantity: 2 }],
    });

    const sourceWarehouseInventory: InventoryItem[] = [
      { productId: 'prod-c', quantity: 2 },
    ];
    const destinationUserInventory: InventoryItem[] = [];

    mockInventoryAdapter.getUserInventory
      .mockResolvedValueOnce(sourceWarehouseInventory)
      .mockResolvedValueOnce(sourceWarehouseInventory)
      .mockResolvedValueOnce(destinationUserInventory);

    await service.transferInventoryItems(form, organizationId);

    expect(mockInventoryAdapter.deleteBulkInventoryItem).toHaveBeenCalledWith(
      'prod-c', organizationId, WAREHOUSE_SUFFIX
    );
    expect(mockInventoryAdapter.createBulkInventoryItem).toHaveBeenCalledWith(
      'prod-c', organizationId, 'user-2', 2
    );
    expect(mockInventoryAdapter.updateInventoryItemQuantity).not.toHaveBeenCalled();
  });

  it('records ownership history when transferring unique items on checkout', async () => {
    const organizationId = 'org-1';
    const form = buildForm({
      userID: 'user-1',
      formID: 'form-checkout-1',
      type: FormType.CheckOut,
      items: [{ productId: 'prod-u', quantity: 1, upis: ['UPI-1'] }],
    });

    const warehouseInventory: InventoryItem[] = [
      { productId: 'prod-u', quantity: 1, upis: ['UPI-1'] },
    ];

    mockInventoryAdapter.getUserInventory
      .mockResolvedValueOnce(warehouseInventory)
      .mockResolvedValueOnce(warehouseInventory)
      .mockResolvedValueOnce([]);

    await service.transferInventoryItems(form, organizationId);

    expect(
      mockInventoryAdapter.updateUniqueInventoryItemHolder
    ).toHaveBeenCalledWith(
      'prod-u',
      'UPI-1',
      organizationId,
      'user-1',
      expect.objectContaining({
        previousHolderId: WAREHOUSE_SUFFIX,
        newHolderId: 'user-1',
        formId: 'form-checkout-1',
        eventType: 'check-out',
      })
    );
  });

  describe('transferCheckInEvent', () => {
    it('moves UPI items from user to warehouse with check-in ownership event', async () => {
      const organizationId = 'org-1';
      const form = buildForm({
        userID: 'user-1',
        formID: 'form-1',
        type: FormType.CheckOut,
        items: [{ productId: 'prod-u', quantity: 1, upis: ['UPI-A'] }],
      });
      const event = {
        checkInEventId: 'cie-1',
        items: [{ productId: 'prod-u', quantity: 1, upis: ['UPI-A'] }],
        createdAtTimestamp: Date.now(),
        createdByUserId: 'wm-1',
      };
      const userInventory: InventoryItem[] = [
        { productId: 'prod-u', quantity: 1, upis: ['UPI-A'] },
      ];
      mockInventoryAdapter.getUserInventory
        .mockResolvedValueOnce(userInventory)   // validation
        .mockResolvedValueOnce(userInventory)   // source
        .mockResolvedValueOnce([]);             // destination

      await service.transferCheckInEvent(form, event, organizationId);

      expect(
        mockInventoryAdapter.updateUniqueInventoryItemHolder
      ).toHaveBeenCalledWith(
        'prod-u',
        'UPI-A',
        organizationId,
        WAREHOUSE_SUFFIX,
        expect.objectContaining({
          previousHolderId: 'user-1',
          newHolderId: WAREHOUSE_SUFFIX,
          formId: 'form-1',
          eventType: 'check-in',
          checkInEventId: 'cie-1',
        })
      );
    });

    it('moves bulk items from user to warehouse', async () => {
      const organizationId = 'org-1';
      const form = buildForm({
        userID: 'user-2',
        formID: 'form-2',
        type: FormType.CheckOut,
        items: [{ productId: 'bulk-1', quantity: 5 }],
      });
      const event = {
        checkInEventId: 'cie-2',
        items: [{ productId: 'bulk-1', quantity: 3 }],
        createdAtTimestamp: Date.now(),
        createdByUserId: 'wm-1',
      };
      const userInventory: InventoryItem[] = [{ productId: 'bulk-1', quantity: 5 }];
      const warehouseInventory: InventoryItem[] = [{ productId: 'bulk-1', quantity: 10 }];
      mockInventoryAdapter.getUserInventory
        .mockResolvedValueOnce(userInventory)
        .mockResolvedValueOnce(userInventory)
        .mockResolvedValueOnce(warehouseInventory);

      await service.transferCheckInEvent(form, event, organizationId);

      expect(mockInventoryAdapter.updateInventoryItemQuantity).toHaveBeenCalledWith(
        'bulk-1', organizationId, 'user-2', 2
      );
      expect(mockInventoryAdapter.updateInventoryItemQuantity).toHaveBeenCalledWith(
        'bulk-1', organizationId, WAREHOUSE_SUFFIX, 13
      );
    });
  });
});
