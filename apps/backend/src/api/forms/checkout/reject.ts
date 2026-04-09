import {
  BasicUser,
  FormStatus,
  JwtPayload,
  RejectForm,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import {
  badRequest,
  internalServerError,
  jwtPayloadRequired,
  organizationIdRequired,
  userIdRequired,
} from '../../responses';

export const handler = async (
  req: RejectForm,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<BasicUser.RejectFormResponse> => {
  try {
    const organizationId = pathParams?.organizationId;
    if (!organizationId) {
      throw organizationIdRequired;
    }

    if (!req.formID || !req.reason) {
      throw badRequest('Form ID and rejection reason are required');
    }

    if (!jwtPayload) {
      throw jwtPayloadRequired;
    }

    if (!req.userId) {
      throw userIdRequired;
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

    if (form.status !== FormStatus.Pending) {
      throw badRequest(
        `Form ${req.formID} is not in pending status (current: ${form.status})`
      );
    }

    // Update form status to rejected with reason and timestamp
    const updatedForm = await formsAdapter.updateForm(req.formID, req.userId, organizationId, {
      status: FormStatus.Rejected,
      rejectionReason: req.reason,
      rejectionByUserId: jwtPayload.sub,
      lastUpdated: Date.now(),
    });

    return { status: true, updatedForm };
  } catch (error) {
    console.error('Error rejecting form:', error);
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error; // Re-throw bad request errors
    }
    throw internalServerError('Failed to reject form');
  }
};
