import {
  ErrorKeys,
  FormStatus,
  FormType,
  InventoryForm,
  JwtPayload,
} from '@equip-track/shared';
import { CreateCheckOutForm, CreateCheckOutFormResponse } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { randomUUID } from 'crypto';
import { badRequest, customError, internalServerError, jwtPayloadRequired, organizationIdRequired, userIdRequired } from '../../responses';
import { validateInventoryItems } from '../../validate';

export const handler = async (
  req: CreateCheckOutForm,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<CreateCheckOutFormResponse> => {
  try {
    const organizationId = pathParams?.organizationId;
    if (!organizationId) {
      throw organizationIdRequired;
    }

    if (!req.userID) {
      throw userIdRequired;
    }

    if (!jwtPayload) {
      throw jwtPayloadRequired;
    }

    if (!req.description) {
      throw customError(ErrorKeys.BAD_REQUEST, 400, 'errors.api.description-required', 'Description is required');
    }
    // Validate items
    validateInventoryItems(req.items);

    const formsAdapter = new FormsAdapter();
    const formID = randomUUID();
    const now = Date.now();

    const form: InventoryForm = {
      userID: req.userID,
      formID,
      organizationID: organizationId,
      items: req.items,
      type: FormType.CheckOut,
      status: FormStatus.Pending,
      createdAtTimestamp: now,
      lastUpdated: now,
      description: req.description,
      createdByUserId: jwtPayload.sub,
    };

    await formsAdapter.createForm(form);

    return { status: true, form };
  } catch (error) {
    console.error('Error creating checkout form:', error);
    throw internalServerError('Failed to create checkout form');
  }
};
