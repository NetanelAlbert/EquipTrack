import {
  BasicResponse,
  SetProduct,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { InventoryAdapter } from '../../../db';
import { badRequest } from '../../responses';

const inventoryAdapter = new InventoryAdapter();

export const handler = async (
  req: SetProduct,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<BasicResponse> => {
  const organizationId = pathParams[ORGANIZATION_ID_PATH_PARAM];
  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  if (!req.product) {
    throw badRequest('Product is required');
  }

  const { product } = req;

  // Validate product
  if (!product.id || !product.name || typeof product.hasUpi !== 'boolean') {
    throw badRequest('Invalid product data: id, name, and hasUpi are required');
  }

  // Create the product
  await inventoryAdapter.createProduct(product, organizationId);

  return { status: true };
};
