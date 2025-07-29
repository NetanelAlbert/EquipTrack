import {
  GetProductsResponse,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { InventoryAdapter } from '../../../db';
import { badRequest, ok, SuccessResponse } from '../../responses';

const inventoryAdapter = new InventoryAdapter();

export const handler = async (
  req: undefined,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<SuccessResponse> => {
  const organizationId = pathParams[ORGANIZATION_ID_PATH_PARAM];
  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  const products = await inventoryAdapter.getAllProductsByOrganization(
    organizationId
  );

  return ok({
    status: true,
    products,
  });
};
