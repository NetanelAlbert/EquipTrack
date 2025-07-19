import { BasicResponse } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { notImplemented } from '../../responses';
// import { OrganizationAdapter } from '../../../db/tables/organization.adapter';

export const handler = async (
  _req: any,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<BasicResponse> => {
  throw notImplemented('Set user endpoint is not yet implemented');
};
