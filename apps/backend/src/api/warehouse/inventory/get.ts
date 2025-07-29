import {
  GetInventoryResponse,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { InventoryAdapter } from '../../../db';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { badRequest } from '../../responses';

const inventoryAdapter = new InventoryAdapter();

export const handler = async (
  _req: unknown,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<GetInventoryResponse> => {
  const organizationId = pathParams[ORGANIZATION_ID_PATH_PARAM];
  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  const totalItems = await inventoryAdapter.getTotalInventory(organizationId);

  return {
    totalItems,
    status: true,
  };
};
