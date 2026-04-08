import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  GetItemsToReportRequestResponse,
  InventoryItem,
  JwtPayload,
  UserRole,
} from '@equip-track/shared';
import { InventoryAdapter } from '../../../db/tables/inventory.adapter';
import { getCustomerDepartmentScope } from './customer-department-scope';

export async function handler(
  _req: unknown,
  pathParams?: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload,
): Promise<GetItemsToReportRequestResponse> {
  const userId = jwtPayload?.sub;
  if (!userId) {
    throw new Error(`User ID is required, got payload: ${JSON.stringify(jwtPayload)}`);
  }

  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  try {
    const inventoryAdapter = new InventoryAdapter();
    const upiItems = await inventoryAdapter.getOrganizationUpiItems(organizationId);

    const userRole = jwtPayload?.orgIdToRole[organizationId];
    if (!userRole) {
      throw new Error(`User role is required, got payload: ${JSON.stringify(jwtPayload)}`);
    }

    if (
      userRole === UserRole.WarehouseManager ||
      userRole === UserRole.Admin ||
      userRole === UserRole.Inspector
    ) {
      return {
        status: true,
        itemsByHolder: Object.fromEntries(upiItems),
      };
    }

    const allowedUserIds = await getCustomerDepartmentScope(userId, organizationId);

    const filteredItemsByHolder: Record<string, InventoryItem[]> = {};
    for (const uid of allowedUserIds) {
      const items = upiItems.get(uid);
      if (items) {
        filteredItemsByHolder[uid] = items;
      }
    }
    if (!filteredItemsByHolder[userId]) {
      filteredItemsByHolder[userId] = upiItems.get(userId) ?? [];
    }

    return {
      status: true,
      itemsByHolder: filteredItemsByHolder,
    };
  } catch (error) {
    console.error('Error getting items to report:', error);
    throw new Error('Failed to get items to report');
  }
}
