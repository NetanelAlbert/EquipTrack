import {
  GetUserInventoryResponse,
  ORGANIZATION_ID_PATH_PARAM,
  USER_ID_PATH_PARAM,
} from '@equip-track/shared';
import { InventoryAdapter } from '../../../db';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { badRequest, ok, SuccessResponse } from '../../responses';

const inventoryAdapter = new InventoryAdapter();

export const handler = async (
  _req: unknown,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<SuccessResponse> => {
  const organizationId = pathParams[ORGANIZATION_ID_PATH_PARAM];
  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }
  const userId = pathParams[USER_ID_PATH_PARAM];
  if (!userId) {
    throw badRequest('User ID is required');
  }

  const items = await inventoryAdapter.getUserInventory(organizationId, userId);

  const products = await inventoryAdapter.getAllProductsByOrganization(
    organizationId
  );

  return ok({ items, products, status: true });
};
