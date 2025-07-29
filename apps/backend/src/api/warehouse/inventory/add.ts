import { AddInventory, ORGANIZATION_ID_PATH_PARAM } from '@equip-track/shared';
import { InventoryAdapter } from '../../../db';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { badRequest, ok, SuccessResponse } from '../../responses';
import { WAREHOUSE_SUFFIX } from '../../../db/constants';

const inventoryAdapter = new InventoryAdapter();

export const handler = async (
  req: AddInventory,
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

    // Execute the inventory addition with lock
    await inventoryAdapter.withInventoryLock(organizationId, async () => {
      // Get current warehouse inventory to merge with existing items
      const currentInventory = await inventoryAdapter.getUserInventory(
        organizationId,
        holderId
      );

      const alreadyExistsUpis = new Set<string>();
      for (const item of currentInventory) {
        if (item.upis && item.upis.length > 0) {
          for (const upi of item.upis) {
            alreadyExistsUpis.add(`${item.productId}:${upi}`);
          }
        }
      }

      for (const item of req.items) {
        if (item.upis && item.upis.length > 0) {
          for (const upi of item.upis) {
            if (alreadyExistsUpis.has(`${item.productId}:${upi}`)) {
              throw badRequest(
                `UPI ${upi} already exists for product ${item.productId}`
              );
            }
          }
        }
      }

      // Process each item to add
      for (const item of req.items) {
        const existingItem = currentInventory.find(
          (inv) => inv.productId === item.productId
        );

        if (item.upis && item.upis.length > 0) {
          // Handle unique items (with UPI)
          for (const upi of item.upis) {
            await inventoryAdapter.createUniqueInventoryItem(
              item.productId,
              upi,
              organizationId,
              holderId
            );
          }
        } else {
          // Handle bulk items (no UPI)
          if (existingItem) {
            // Update existing bulk item
            await inventoryAdapter.updateInventoryItemQuantity(
              item.productId,
              organizationId,
              holderId,
              existingItem.quantity + item.quantity
            );
          } else {
            // Create new bulk item
            await inventoryAdapter.createBulkInventoryItem(
              item.productId,
              organizationId,
              holderId,
              item.quantity
            );
          }
        }
      }
    });

    return ok({ status: true });
  } catch (error) {
    console.error('Error adding inventory:', error);
    // If it's already an error response, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    throw badRequest(
      `Failed to add inventory: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
};
