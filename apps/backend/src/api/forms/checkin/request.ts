import { BasicResponse, FormStatus, FormType, JwtPayload } from '@equip-track/shared';
import { BasicUser } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { randomUUID } from 'crypto';
import { badRequest, internalServerError, ok, SuccessResponse } from '../../responses';

export const handler = async (
  req: BasicUser.RequestCheckIn,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<SuccessResponse> => {
  try {
    const organizationId = pathParams?.organizationId;
    if (!organizationId) {
      throw badRequest('Organization ID is required');
    }

    if (!jwtPayload) {
      throw badRequest('User ID is required');
    }

    const formsAdapter = new FormsAdapter();
    const formID = randomUUID();
    const now = Date.now();

    const userId = jwtPayload.sub;

    const form = {
      userID: userId,
      formID,
      organizationID: organizationId,
      items: req.items,
      type: FormType.CheckIn,
      status: FormStatus.Pending,
      createdAtTimestamp: now,
      lastUpdated: now,
    };

    await formsAdapter.createForm(form);

    return ok({ status: true });
  } catch (error) {
    console.error('Error creating check-in form:', error);
    // If it's already an error response, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    throw internalServerError('Failed to create check-in form');
  }
};
