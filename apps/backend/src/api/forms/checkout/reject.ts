import {
  BasicResponse,
  FormStatus,
  JwtPayload,
  RejectForm,
  UserRole,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { badRequest, forbidden, internalServerError } from '../../responses';

export const handler = async (
  req: RejectForm,
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

    if (!req.userId) {
      throw badRequest('User ID is required');
    }

    const formsAdapter = new FormsAdapter();

    const form = await formsAdapter.getForm(
      req.userId,
      organizationId,
      req.formID
    );

    if (!form) {
      throw badRequest(
        `Form with ID ${req.formID} not found for user ${req.userId}`
      );
    }

    // Update form status to rejected with reason and timestamp
    await formsAdapter.updateForm(req.formID, req.userId, organizationId, {
      status: FormStatus.Rejected,
      rejectionReason: req.reason,
      rejectionByUserId: jwtPayload.sub,
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
