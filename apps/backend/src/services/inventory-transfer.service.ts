import { InventoryForm, InventoryItem, FormType } from '@equip-track/shared';
import { InventoryAdapter } from '../db/tables/inventory.adapter';
import { WAREHOUSE_SUFFIX } from '../db/constants';
import { badRequest } from '../api/responses';

export class InventoryTransferService {
  private readonly inventoryAdapter = new InventoryAdapter();

  /**
   * Transfers inventory items between holders during form approval
   * Uses inventory locking to ensure thread-safe operations
   */
  async transferInventoryItems(
    form: InventoryForm,
    organizationId: string
  ): Promise<void> {
    await this.inventoryAdapter.withInventoryLock(organizationId, async () => {
      // Determine source and destination holders based on form type
      const { sourceHolderId, destinationHolderId } =
        this.getTransferHolders(form);

      // Validate that source holder has sufficient items
      await this.validateSourceHolderInventory(
        form.items,
        organizationId,
        sourceHolderId
      );

      // Perform the transfer
      await this.performTransfer(
        form.items,
        organizationId,
        sourceHolderId,
        destinationHolderId
      );
    });
  }

  /**
   * Determines source and destination holders based on form type
   */
  private getTransferHolders(form: InventoryForm): {
    sourceHolderId: string;
    destinationHolderId: string;
  } {
    if (form.type === FormType.CheckOut) {
      // CHECK-OUT: warehouse → user
      return {
        sourceHolderId: WAREHOUSE_SUFFIX,
        destinationHolderId: form.userID,
      };
    } else if (form.type === FormType.CheckIn) {
      // CHECK-IN: user → warehouse
      return {
        sourceHolderId: form.userID,
        destinationHolderId: WAREHOUSE_SUFFIX,
      };
    } else {
      throw badRequest(`Invalid form type: ${form.type}`);
    }
  }

  /**
   * Validates that the source holder has sufficient inventory items
   */
  private async validateSourceHolderInventory(
    items: InventoryItem[],
    organizationId: string,
    sourceHolderId: string
  ): Promise<void> {
    const currentInventory = await this.inventoryAdapter.getUserInventory(
      organizationId,
      sourceHolderId
    );

    // Create a map of current inventory for easy lookup
    const currentInventoryMap = new Map<string, InventoryItem>();
    currentInventory.forEach((item) => {
      currentInventoryMap.set(item.productId, item);
    });

    // Validate each requested item
    for (const requestedItem of items) {
      const currentItem = currentInventoryMap.get(requestedItem.productId);

      if (!currentItem) {
        throw badRequest(
          `Product ${requestedItem.productId} not found in ${
            sourceHolderId === WAREHOUSE_SUFFIX ? 'warehouse' : 'user'
          } inventory`
        );
      }

      if (requestedItem.upis && requestedItem.upis.length > 0) {
        // Handle unique items (with UPI) - validate that all UPIs exist
        const currentUpis = currentItem.upis || [];
        for (const upi of requestedItem.upis) {
          if (!currentUpis.includes(upi)) {
            throw badRequest(
              `UPI ${upi} not found for product ${requestedItem.productId} in ${
                sourceHolderId === WAREHOUSE_SUFFIX ? 'warehouse' : 'user'
              } inventory`
            );
          }
        }
      } else {
        // Handle bulk items - validate sufficient quantity
        if (currentItem.quantity < requestedItem.quantity) {
          throw badRequest(
            `Insufficient quantity for product ${requestedItem.productId}. Available: ${currentItem.quantity}, requested: ${requestedItem.quantity}`
          );
        }
      }
    }
  }

  /**
   * Performs the actual inventory transfer between holders
   */
  private async performTransfer(
    items: InventoryItem[],
    organizationId: string,
    sourceHolderId: string,
    destinationHolderId: string
  ): Promise<void> {
    // Get inventories once before processing bulk items
    const sourceInventory = await this.inventoryAdapter.getUserInventory(
      organizationId,
      sourceHolderId
    );
    const destinationInventory = await this.inventoryAdapter.getUserInventory(
      organizationId,
      destinationHolderId
    );

    for (const item of items) {
      if (item.upis && item.upis.length > 0) {
        // Handle unique items (with UPI)
        await this.transferUniqueItems(
          item,
          organizationId,
          destinationHolderId
        );
      } else {
        // Handle bulk items - pass inventories and get updated versions
        await this.transferBulkItems(
          item,
          organizationId,
          sourceHolderId,
          destinationHolderId,
          sourceInventory.find((item) => item.productId === item.productId),
          destinationInventory.find((item) => item.productId === item.productId)
        );  
      }
    }
  }

  /**
   * Transfers unique items (with UPIs) between holders
   */
  private async transferUniqueItems(
    item: InventoryItem,
    organizationId: string,
    destinationHolderId: string
  ): Promise<void> {
    if (!item.upis || item.upis.length === 0) {
      throw new Error('UPIs required for unique item transfer');
    }

    // Update holder information for each UPI
    for (const upi of item.upis) {
      await this.inventoryAdapter.updateUniqueInventoryItemHolder(
        item.productId,
        upi,
        organizationId,
        destinationHolderId
      );
    }
  }

  /**
   * Transfers bulk items (without UPIs) between holders
   */
  private async transferBulkItems(
    item: InventoryItem,
    organizationId: string,
    sourceHolderId: string,
    destinationHolderId: string,
    sourceItem?: InventoryItem,
    destinationItem?: InventoryItem
  ): Promise<void> {

    if (!sourceItem) {
      throw new Error(`Source item not found: ${item.productId}`);
    }

    const newSourceQuantity = sourceItem.quantity - item.quantity;

    // Update or delete source item
    if (newSourceQuantity === 0) {
      await this.inventoryAdapter.deleteBulkInventoryItem(
        item.productId,
        organizationId,
        sourceHolderId
      );
    } else {
      await this.inventoryAdapter.updateInventoryItemQuantity(
        item.productId,
        organizationId,
        sourceHolderId,
        newSourceQuantity
      );
    }

    // Handle destination item
    if (destinationItem) {
      // Update existing item
      const newDestinationQuantity = destinationItem.quantity + item.quantity;
      await this.inventoryAdapter.updateInventoryItemQuantity(
        item.productId,
        organizationId,
        destinationHolderId,
        newDestinationQuantity
      );
    } else {
      // Create new item
      await this.inventoryAdapter.createBulkInventoryItem(
        item.productId,
        organizationId,
        destinationHolderId,
        item.quantity
      );
    }
  }
}
