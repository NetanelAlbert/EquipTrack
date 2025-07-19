import { GetUsersResponse } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { notImplemented } from '../../responses';
// import { OrganizationAdapter } from '../../../db/tables/organization.adapter';

export const handler = async (
  _req: any,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<GetUsersResponse> => {
  throw notImplemented('Get users endpoint is not yet implemented');
};
