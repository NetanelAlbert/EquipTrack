import { BasicResponse } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
// import { OrganizationAdapter } from '../../../db/tables/organization.adapter';

export const handler = async (
  _req: any,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<BasicResponse> => {
  // TODO: Use OrganizationAdapter to add user
  return { status: true };
};
