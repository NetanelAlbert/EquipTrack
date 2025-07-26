import {
  BasicResponse,
  FormStatus,
  ApproveCheckOut,
  JwtPayload,
  UserRole,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { UsersAndOrganizationsAdapter } from '../../../db/tables/users-and-organizations.adapter';
import { InventoryTransferService } from '../../../services/inventory-transfer.service';
import { PdfService } from '../../../services/pdf.service';
import { S3Service } from '../../../services/s3.service';
import { badRequest, forbidden } from '../../responses';

export const handler = async (
  req: ApproveCheckOut,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<BasicResponse> => {
  try {
    const organizationId = pathParams?.organizationId;
    if (!organizationId) {
      throw badRequest('Organization ID is required');
    }

    if (!req.formID) {
      throw badRequest('Form ID is required');
    }

    if (!jwtPayload) {
      throw badRequest('User authentication required');
    }

    if (!req.signature) {
      throw badRequest('Signature is required');
    }

    // Initialize services and adapters
    const formsAdapter = new FormsAdapter();
    const usersAdapter = new UsersAndOrganizationsAdapter();
    const inventoryTransferService = new InventoryTransferService();
    const s3Service = new S3Service();

    // Step 1: Get the form and validate it exists
    const userId = jwtPayload.sub;
    const userRole = jwtPayload.orgIdToRole[organizationId];
    const form = await formsAdapter.getForm(userId, organizationId, req.formID);
    if (
      form.userID !== userId &&
      userRole !== UserRole.Admin &&
      userRole !== UserRole.WarehouseManager
    ) {
      throw forbidden('You are not authorized to approve this form');
    }

    if (!form) {
      throw badRequest(`Form with ID ${req.formID} not found`);
    }

    if (form.status !== FormStatus.Pending) {
      throw badRequest(
        `Form ${req.formID} is not in pending status (current: ${form.status})`
      );
    }

    form.items.forEach((item) => {
      if (item.upis && item.upis.length !== item.quantity) {
        throw badRequest(
          `Item ${item.productId} has a quantity of ${item.quantity} which is not equal to the number of UPI's ${item.upis.length}`
        );
      }
    });

    // Step 2: Get user data for PDF generation
    const usersByOrganization = await usersAdapter.getUsersByOrganization(
      organizationId
    );
    const userAndOrg = usersByOrganization.find(
      (uo) => uo.user.id === form.userID
    );

    if (!userAndOrg) {
      throw badRequest(`User ${form.userID} not found in organization`);
    }

    const formUser = userAndOrg.user;

    console.log(`Starting approval process for form ${req.formID}`);

    // Step 3: Transfer inventory items (with locking)
    console.log('Transferring inventory items...');
    await inventoryTransferService.transferInventoryItems(form, organizationId);
    console.log('Inventory transfer completed successfully');

    // Step 4: Generate PDF
    console.log('Generating PDF...');
    const pdfBuffer = PdfService.generateFormPDF(form, formUser, req.signature);
    console.log('PDF generated successfully');

    // Step 5: Upload PDF to S3
    console.log('Uploading PDF to S3...');
    const pdfUrl = await s3Service.uploadFormPDF(
      pdfBuffer,
      organizationId,
      form.type,
      form.userID,
      form.formID
    );
    console.log(`PDF uploaded successfully: ${pdfUrl}`);

    // Step 6: Update form with approval metadata
    console.log('Updating form status...');
    const now = Date.now();
    await formsAdapter.updateForm(req.formID, form.userID, organizationId, {
      status: FormStatus.Approved,
      approvedAtTimestamp: now,
      approvedByUserId: userId,
      pdfUri: pdfUrl,
      lastUpdated: now,
    });
    console.log('Form approval completed successfully');

    return { status: true };
  } catch (error) {
    console.error('Error approving form:', error);

    // Re-throw badRequest errors to maintain proper error responses
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    // Handle specific error types
    if (error instanceof Error) {
      if (
        error.message.includes('not found') ||
        error.message.includes('Insufficient')
      ) {
        throw badRequest(error.message);
      }
    }

    // Generic error response
    return {
      status: false,
      errorMessage: `Failed to approve form: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
};
