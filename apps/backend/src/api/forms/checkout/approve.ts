import { BasicResponse } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { notImplemented } from '../../responses';
// import { InventoryFormAdapter } from '../../../../db/tables/inventory-form.adapter';

export const handler = async (
  _req: any,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<BasicResponse> => {
  throw notImplemented('Approve checkout endpoint is not yet implemented');
};
