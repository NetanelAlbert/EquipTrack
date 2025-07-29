import {
  BasicResponse,
  DeleteProduct,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { InventoryAdapter } from '../../../db';
import { badRequest, ok, SuccessResponse } from '../../responses';

const inventoryAdapter = new InventoryAdapter();

export const handler = async (
  req: DeleteProduct,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<SuccessResponse> => {
  const organizationId = pathParams[ORGANIZATION_ID_PATH_PARAM];
  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  if (!req.productId) {
    throw badRequest('Product ID is required');
  }

  const { productId } = req;

  // Validate product ID format
  if (typeof productId !== 'string' || productId.trim() === '') {
    throw badRequest('Invalid product ID format');
  }

  await inventoryAdapter.withInventoryLock(organizationId, async () => {
    // Check if the product is used in any inventory items
    const isProductUsed = await inventoryAdapter.isProductUsedInInventory(
      productId,
      organizationId
    );

    if (isProductUsed) {
      throw badRequest(
        'Cannot delete product: it is currently used in inventory items'
      );
    }

    // Delete the product
    await inventoryAdapter.deleteProduct(productId, organizationId);
  });

  return ok({ status: true });
};
