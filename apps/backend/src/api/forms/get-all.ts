import {
  GetAllFormsResponse,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { FormsAdapter } from '../../db/tables/forms.adapter';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { badRequest, ok, SuccessResponse } from '../responses';

const formsAdapter = new FormsAdapter();

export const handler = async (
  _req: unknown,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<SuccessResponse> => {
  const organizationId = pathParams?.[ORGANIZATION_ID_PATH_PARAM];
  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  const forms = await formsAdapter.getOrganizationForms(organizationId);

  return ok({ status: true, forms });
};
