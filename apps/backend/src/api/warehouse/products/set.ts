import {
  BasicResponse,
  SetProduct,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { InventoryAdapter } from '../../../db';
import { badRequest, ok, SuccessResponse } from '../../responses';

const inventoryAdapter = new InventoryAdapter();

export const handler = async (
  req: SetProduct,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<SuccessResponse> => {
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

  const isProductUsed = await inventoryAdapter.isProductUsedInInventory(
    product.id,
    organizationId
  );
  if (isProductUsed) {
    const productFromDB = await inventoryAdapter.getProductFromDB(
      product.id,
      organizationId
    );
    if (productFromDB && productFromDB.hasUpi !== product.hasUpi) {
      throw badRequest(
        `Can't change the hasUpi flag for a product that is used in inventory`
      );
    }
  }

  await inventoryAdapter.withInventoryLock(organizationId, async () => {
    await inventoryAdapter.createProduct(product, organizationId);
  });

  return ok({ status: true });
};
