import { BasicResponse } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
// import { InventoryAdapter } from '../../../../db/tables/inventory.adapter';

export const handler = async (
  _req: any,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<BasicResponse> => {
  // TODO: Use InventoryAdapter to add inventory
  return { status: true };
};
