import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  GetItemsToReportRequestResponse,
  getUserIDsOfSameSubDepartment,
  InventoryItem,
  JwtPayload,
  UserRole,
} from '@equip-track/shared';
import { UsersAndOrganizationsAdapter } from '../../../db';
import { InventoryAdapter } from '../../../db/tables/inventory.adapter';
import {
  badRequest,
  internalServerError,
  isErrorResponse,
  jwtPayloadRequired,
  organizationIdRequired,
} from '../../responses';

export async function handler(
  _req: unknown,
  pathParams?: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload,
): Promise<GetItemsToReportRequestResponse> {
  const userId = jwtPayload?.sub;
  if (!userId) {
    throw jwtPayloadRequired;
  }

  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw organizationIdRequired;
  }

  try {
    const inventoryAdapter = new InventoryAdapter();
    const upiItems = await inventoryAdapter.getOrganizationUpiItems(organizationId);

    const userRole = jwtPayload?.orgIdToRole?.[organizationId];
    if (!userRole) {
      throw badRequest('User role not found for this organization');
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

    const usersAndOrganizationsAdapter = new UsersAndOrganizationsAdapter();    
    const users = await usersAndOrganizationsAdapter.getUsersByOrganization(organizationId);
    
    const user = users.find((u) => u.user.id === userId);
    if (!user) {
      throw badRequest('User not found in organization');
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
    if (isErrorResponse(error)) {
      throw error;
    }
    throw internalServerError('Failed to get items to report');
  }
}
