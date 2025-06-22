import { BasicResponse } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
// import { InventoryFormAdapter } from '../../../../db/tables/inventory-form.adapter';

export const handler = async (
  _req: any,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<BasicResponse> => {
  // TODO: Use InventoryFormAdapter to reject checkout
  return { status: true };
};
