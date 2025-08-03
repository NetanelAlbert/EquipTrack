import {
  ErrorKeys,
  FormStatus,
  FormType,
  InventoryForm,
  JwtPayload,
} from '@equip-track/shared';
import { CreateForm, CreateCheckOutFormResponse } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { randomUUID } from 'crypto';
import {
  customError,
  internalServerError,
  jwtPayloadRequired,
  organizationIdRequired,
  userIdRequired,
} from '../../responses';
import { validateInventoryItems } from '../../validate';

export const handler = async (
  req: CreateForm,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<CreateCheckOutFormResponse> => {
  try {
    const organizationId = pathParams?.organizationId;
    if (!organizationId) {
      throw organizationIdRequired;
    }

    if (!req.userId) {
      throw userIdRequired;
    }

    if (!jwtPayload) {
      throw jwtPayloadRequired;
    }

    if (!req.description) {
      throw customError(
        ErrorKeys.BAD_REQUEST,
        400,
        'errors.api.description-required',
        'Description is required'
      );
    }

    if (![FormType.CheckIn, FormType.CheckOut].includes(req.formType)) {
      throw customError(
        ErrorKeys.BAD_REQUEST,
        400,
        'errors.api.invalid-form-type',
        'Invalid form type'
      );
    }

    // Validate items
    validateInventoryItems(req.items);

    const formsAdapter = new FormsAdapter();
    const formID = randomUUID();
    const now = Date.now();

    const form: InventoryForm = {
      userID: req.userId,
      formID,
      organizationID: organizationId,
      items: req.items,
      type: req.formType,
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
