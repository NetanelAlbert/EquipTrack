import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  GetItemOwnershipHistoryRequest,
  GetItemOwnershipHistoryResponse,
} from '@equip-track/shared';
import { InventoryAdapter } from '../../../db/tables/inventory.adapter';

export async function handler(
  req: GetItemOwnershipHistoryRequest,
  pathParams?: APIGatewayProxyEventPathParameters
): Promise<GetItemOwnershipHistoryResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  if (!req.productId || !req.upi) {
    throw new Error('Product ID and UPI are required');
  }

  const inventoryAdapter = new InventoryAdapter();

  try {
    const row = await inventoryAdapter.getUniqueInventoryItem(
      req.productId,
      req.upi,
      organizationId
    );

    const raw = row?.ownershipHistory ?? [];
    const ownershipHistory = [...raw].sort((a, b) => b.timestamp - a.timestamp);

    return {
      status: true,
      ownershipHistory,
    };
  } catch (error) {
    console.error('Error getting item ownership history:', error);
    throw new Error('Failed to get item ownership history');
  }
}
