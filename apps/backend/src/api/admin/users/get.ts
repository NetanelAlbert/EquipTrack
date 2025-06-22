import { GetUsersResponse } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
// import { OrganizationAdapter } from '../../../db/tables/organization.adapter';

export const handler = async (
  _req: any,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<GetUsersResponse> => {
  // TODO: Use OrganizationAdapter to get users
  // For now, just return a dummy users list
  return { users: [], status: true };
};
