import { BasicResponse, FormStatus, RejectCheckOut } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { badRequest } from '../../responses';

export const handler = async (
  req: RejectCheckOut,
  pathParams: APIGatewayProxyEventPathParameters,
  userId?: string
): Promise<BasicResponse> => {
  try {
    const organizationId = pathParams?.organizationId;
    if (!organizationId) {
      throw badRequest('Organization ID is required');
    }

    if (!req.formID || !req.reason) {
      throw badRequest('Form ID and rejection reason are required');
    }

    if (!userId) {
      throw badRequest('User authentication required');
    }

    const formsAdapter = new FormsAdapter();

    // Get all forms for the organization to find the specific form
    const organizationForms = await formsAdapter.getOrganizationForms(
      organizationId
    );
    const form = organizationForms.find((f) => f.formID === req.formID);

    if (!form) {
      throw badRequest(`Form with ID ${req.formID} not found`);
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
    return { status: false, errorMessage: 'Failed to reject form' };
  }
};
