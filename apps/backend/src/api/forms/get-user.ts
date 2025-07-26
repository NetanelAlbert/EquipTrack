import {
  GetUserFormsResponse,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { FormsAdapter } from '../../db/tables/forms.adapter';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { badRequest } from '../responses';

const formsAdapter = new FormsAdapter();

export const handler = async (
  _req: unknown,
  pathParams: APIGatewayProxyEventPathParameters,
  userId?: string
): Promise<GetUserFormsResponse> => {
  if (!userId) {
    throw badRequest('User ID is required');
  }

  const organizationId = pathParams?.[ORGANIZATION_ID_PATH_PARAM];
  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  const forms = await formsAdapter.getUserForms(userId);

  return { status: true, forms };
};
