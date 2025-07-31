import {
  BasicResponse,
  FormStatus,
  FormType,
  JwtPayload,
} from '@equip-track/shared';
import { BasicUser } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { randomUUID } from 'crypto';
import { badRequest, internalServerError } from '../../responses';
import { validateInventoryItems } from '../../validate';

export const handler = async (
  req: BasicUser.RequestCheckIn,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<BasicUser.RequestCheckInResponse> => {
  try {
    const organizationId = pathParams?.organizationId;
    if (!organizationId) {
      throw badRequest('Organization ID is required');
    }

    if (!req.userId) {
      throw badRequest('User ID is required');
    }

    // Validate items
    validateInventoryItems(req.items);

    const formsAdapter = new FormsAdapter();
    const formID = randomUUID();
    const now = Date.now();

    const userId = req.userId;

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

    return { status: true, form };
  } catch (error) {
    console.error('Error creating check-in form:', error);
    throw internalServerError('Failed to create check-in form');
  }
};
