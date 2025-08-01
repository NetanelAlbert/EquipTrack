import {
  ErrorKeys,
  FormStatus,
  FormType,
  JwtPayload,
} from '@equip-track/shared';
import { BasicUser } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { randomUUID } from 'crypto';
import { customError, internalServerError } from '../../responses';
import { validateInventoryItems } from '../../validate';

export const handler = async (
  req: BasicUser.RequestCheckIn,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<BasicUser.RequestCheckInResponse> => {
  try {
    const organizationId = pathParams?.organizationId;
    if (!organizationId) {
      throw customError(ErrorKeys.BAD_REQUEST, 400, 'errors.api.organization-id-required', 'Organization ID is required');
    }

    if (!req.userId) {
      throw customError(ErrorKeys.BAD_REQUEST, 400, 'errors.api.user-id-required', 'User ID is required');
    }

    if (!jwtPayload) {
      throw customError(ErrorKeys.BAD_REQUEST, 400, 'errors.api.jwt-payload-required', 'JWT payload is required');
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
      createdByUserId: jwtPayload?.sub,
    };

    await formsAdapter.createForm(form);

    return { status: true, form };
  } catch (error) {
    console.error('Error creating check-in form:', error);
    throw internalServerError('Failed to create check-in form');
  }
};
