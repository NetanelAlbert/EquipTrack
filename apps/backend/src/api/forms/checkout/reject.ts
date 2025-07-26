import {
  BasicResponse,
  FormStatus,
  JwtPayload,
  RejectCheckOut,
  UserRole,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { badRequest, forbidden, internalServerError } from '../../responses';

export const handler = async (
  req: RejectCheckOut,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<BasicResponse> => {
  try {
    const organizationId = pathParams?.organizationId;
    if (!organizationId) {
      throw badRequest('Organization ID is required');
    }

    if (!req.formID || !req.reason) {
      throw badRequest('Form ID and rejection reason are required');
    }

    if (!jwtPayload) {
      throw badRequest('User authentication required');
    }

    const formsAdapter = new FormsAdapter();

    const form = await formsAdapter.getForm(
      jwtPayload.sub,
      organizationId,
      req.formID
    );

    if (!form) {
      throw badRequest(`Form with ID ${req.formID} not found`);
    }

    if (form.userID !== jwtPayload.sub &&
      jwtPayload.orgIdToRole[organizationId] !== UserRole.Admin &&
      jwtPayload.orgIdToRole[organizationId] !== UserRole.WarehouseManager
    ) {
      throw forbidden('You are not authorized to reject this form');
    }

    // Update form status to rejected with reason and timestamp
    await formsAdapter.updateForm(req.formID, form.userID, organizationId, {
      status: FormStatus.Rejected,
      rejectionReason: req.reason,
      lastUpdated: Date.now(),
    });

    return { status: true };
  } catch (error) {
    console.error('Error rejecting form:', error);
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error; // Re-throw bad request errors
    }
    throw internalServerError('Failed to reject form');
  }
};
