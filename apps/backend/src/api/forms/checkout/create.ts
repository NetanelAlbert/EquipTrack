import { BasicResponse, FormStatus, FormType } from '@equip-track/shared';
import { CreateCheckOutForm } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { randomUUID } from 'crypto';
import { badRequest, internalServerError } from '../../responses';

export const handler = async (
  req: CreateCheckOutForm,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<BasicResponse> => {
  try {
    const organizationId = pathParams?.organizationId;
    if (!organizationId) {
      throw badRequest('Organization ID is required');
    }
    req.items.forEach((item) => {
      if (item.upis && item.upis.length !== item.quantity) {
        throw badRequest(`Item ${item.productId} has a quantity of ${item.quantity} which is not equal to the number of UPI's ${item.upis.length}`);
      }
    });

    const formsAdapter = new FormsAdapter();
    const formID = randomUUID();
    const now = Date.now();

    const form = {
      userID: req.userID,
      formID,
      organizationID: organizationId,
      items: req.items,
      type: FormType.CheckOut,
      status: FormStatus.Pending,
      createdAtTimestamp: now,
      lastUpdated: now,
    };

    await formsAdapter.createForm(form);

    return { status: true };
  } catch (error) {
    console.error('Error creating checkout form:', error);
    throw internalServerError('Failed to create checkout form');
  }
};
