import {
  RemoveInventory,
  ORGANIZATION_ID_PATH_PARAM,
  InventoryItem,
} from '@equip-track/shared';
import { InventoryAdapter } from '../../../db';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { badRequest, ok, SuccessResponse } from '../../responses';
import { WAREHOUSE_SUFFIX } from '../../../db/constants';

const inventoryAdapter = new InventoryAdapter();

export const handler = async (
  req: RemoveInventory,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<SuccessResponse> => {
  const organizationId = pathParams[ORGANIZATION_ID_PATH_PARAM];
  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  if (!req.items || !Array.isArray(req.items) || req.items.length === 0) {
    throw badRequest('Items array is required and must not be empty');
  }

  // Validate items
  for (const item of req.items) {
    if (!item.productId || typeof item.productId !== 'string') {
      throw badRequest('Each item must have a valid productId');
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      throw badRequest('Each item must have a positive quantity');
    }
    if (item.upis && !Array.isArray(item.upis)) {
      throw badRequest('UPIs must be an array if provided');
    }
    if (item.upis && item.upis.length > 0) {
      for (const upi of item.upis) {
        if (!upi || typeof upi !== 'string') {
          throw badRequest('Each UPI must be a valid string');
        }
      }
    }
  }

  try {
    const holderId = WAREHOUSE_SUFFIX;

    // Execute the inventory removal with lock
    await inventoryAdapter.withInventoryLock(organizationId, async () => {
      // Get current warehouse inventory to validate removal
      const currentInventory = await inventoryAdapter.getUserInventory(
        organizationId,
        holderId
      );

      // Create a map of current inventory for easy lookup
      const currentInventoryMap = new Map<string, InventoryItem>();
      currentInventory.forEach((item) => {
        currentInventoryMap.set(item.productId, item);
      });

      // Validate that we have sufficient inventory for all removals
      for (const item of req.items) {
        const currentItem = currentInventoryMap.get(item.productId);

        if (!currentItem) {
          throw badRequest(
            `Product ${item.productId} not found in warehouse inventory`
          );
        }

        if (item.upis && item.upis.length > 0) {
          // Handle unique items (with UPI) - validate that all UPIs exist
          const currentUpis = currentItem.upis || [];
          for (const upi of item.upis) {
            if (!currentUpis.includes(upi)) {
              throw badRequest(
                `UPI ${upi} not found for product ${item.productId} in warehouse inventory`
              );
            }
          }
        } else {
          // Handle bulk items - validate sufficient quantity
          if (currentItem.quantity < item.quantity) {
            throw badRequest(
              `Insufficient quantity for product ${item.productId}. Available: ${currentItem.quantity}, requested: ${item.quantity}`
            );
          }
        }
      }

      // Process each item to remove
      for (const item of req.items) {
        // We already validated this exists
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const currentItem = currentInventoryMap.get(item.productId)!; 

        if (item.upis && item.upis.length > 0) {
          // Handle unique items (with UPI) - remove specific UPIs
          for (const upi of item.upis) {
            await inventoryAdapter.deleteUniqueInventoryItem(
              item.productId,
              upi,
              organizationId
            );
          }
        } else {
          // Handle bulk items - reduce quantity or delete if zero
          const newQuantity = currentItem.quantity - item.quantity;

          if (newQuantity === 0) {
            // Delete the bulk item entirely
            await inventoryAdapter.deleteBulkInventoryItem(
              item.productId,
              organizationId,
              holderId
            );
          } else {
            // Update the quantity
            await inventoryAdapter.updateInventoryItemQuantity(
              item.productId,
              organizationId,
              holderId,
              newQuantity
            );
          }
        }
      }
    });

    return ok({ status: true });
  } catch (error) {
    console.error('Error removing inventory:', error);
    // If it's already an error response, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    throw badRequest(
      `Failed to remove inventory: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
};
