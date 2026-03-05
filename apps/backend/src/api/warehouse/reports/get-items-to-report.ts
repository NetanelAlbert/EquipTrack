import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  GetItemsToReportRequestResponse,
  InventoryItem,
  JwtPayload,
  UserRole,
} from '@equip-track/shared';
import { InventoryAdapter } from 'apps/backend/src/db/tables/inventory.adapter';
import { UsersAndOrganizationsAdapter } from 'apps/backend/src/db';
import { getUserIDsOfSameSubDepartment } from '@equip-track/shared';

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

    if (userRole === UserRole.WarehouseManager || userRole === UserRole.Admin) {
        return {
            status: true,
            itemsByHolder: Object.fromEntries(upiItems),
        };
    }

    const usersAndOrganizationsAdapter = new UsersAndOrganizationsAdapter();    
    const users = await usersAndOrganizationsAdapter.getUsersByOrganization(organizationId);
    
    const user = users.find((u) => u.user.id === userId);
    if (!user) {
      throw new Error(`User ${userId} not found in organization ${organizationId}`);
    }

    const userIdsWithSameDepartment = getUserIDsOfSameSubDepartment(users, user);
    
    const filteredItemsByHolder: Record<string, InventoryItem[]> = {};
    userIdsWithSameDepartment.forEach((uid) => {
      const items = upiItems.get(uid);
      if (items) {
        filteredItemsByHolder[uid] = items;
      }
    });
    filteredItemsByHolder[userId] = upiItems.get(userId) ?? [];

    return {
      status: true,
      itemsByHolder: filteredItemsByHolder,
    };
  } catch (error) {
    console.error('Error getting items to report:', error);
    throw new Error('Failed to get items to report');
  }
}
