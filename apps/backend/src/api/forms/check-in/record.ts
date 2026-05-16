import {
  BasicUser,
  CheckInEvent,
  FORM_ID_PATH_PARAM,
  FormStatus,
  getOutstandingItems,
  JwtPayload,
  ORGANIZATION_ID_PATH_PARAM,
  USER_ID_PATH_PARAM,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { UsersAndOrganizationsAdapter } from '../../../db/tables/users-and-organizations.adapter';
import { InventoryTransferService } from '../../../services/inventory-transfer.service';
import { PdfService } from '../../../services/pdf.service';
import { S3Service } from '../../../services/s3.service';
import {
  badRequest,
  formIdRequired,
  internalServerError,
  isErrorResponse,
  jwtPayloadRequired,
  organizationIdRequired,
  userIdRequired,
} from '../../responses';
import { validateInventoryItems } from '../../validate';

function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `cie-${timestamp}-${random}`;
}

export const handler = async (
  req: BasicUser.RecordCheckIn,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<BasicUser.RecordCheckInResponse> => {
  try {
    const organizationId = pathParams?.[ORGANIZATION_ID_PATH_PARAM];
    if (!organizationId) throw organizationIdRequired;

    const formId = pathParams?.[FORM_ID_PATH_PARAM];
    if (!formId) throw formIdRequired;

    const userId = pathParams?.[USER_ID_PATH_PARAM];
    if (!userId) throw userIdRequired;

    if (!jwtPayload) throw jwtPayloadRequired;

    if (!req.items || req.items.length === 0) {
      throw badRequest('At least one item is required');
    }

    if (!req.signature) {
      throw badRequest('Signature is required');
    }

    validateInventoryItems(req.items);

    const formsAdapter = new FormsAdapter();
    const usersAdapter = new UsersAndOrganizationsAdapter();
    const inventoryTransferService = new InventoryTransferService();
    const s3Service = new S3Service();

    // Load and validate form
    const form = await formsAdapter.getForm(userId, organizationId, formId);
    if (!form) throw badRequest(`Form ${formId} not found`);
    if (form.status !== FormStatus.Approved) {
      throw badRequest(
        `Form ${formId} is not approved (current status: ${form.status})`
      );
    }

    // Validate requested items are a subset of outstanding items
    const outstanding = getOutstandingItems(form);
    for (const reqItem of req.items) {
      const outItem = outstanding.find((o) => o.productId === reqItem.productId);
      if (!outItem) {
        throw badRequest(
          `Product ${reqItem.productId} is not outstanding on form ${formId}`
        );
      }
      if (reqItem.upis && reqItem.upis.length > 0) {
        const outUpis = new Set(outItem.upis ?? []);
        for (const upi of reqItem.upis) {
          if (!outUpis.has(upi)) {
            throw badRequest(
              `UPI ${upi} is not outstanding for product ${reqItem.productId}`
            );
          }
        }
      } else if (reqItem.quantity > outItem.quantity) {
        throw badRequest(
          `Requested quantity ${reqItem.quantity} exceeds outstanding ${outItem.quantity} for product ${reqItem.productId}`
        );
      }
    }

    // Build event
    const now = Date.now();
    const checkInEventId = generateEventId();
    const event: CheckInEvent = {
      checkInEventId,
      items: req.items,
      createdAtTimestamp: now,
      createdByUserId: jwtPayload.sub,
    };

    // Load user for PDF
    const user = await usersAdapter.getUserFromDB(userId);
    if (!user) throw badRequest(`User ${userId} not found`);

    // Generate and upload PDF
    console.log(`Generating check-in event PDF for event ${checkInEventId}`);
    const pdfBuffer = PdfService.generateCheckInEventPdf(form, event, user, req.signature);
    const pdfUri = await s3Service.uploadCheckInEventPDF(
      pdfBuffer,
      organizationId,
      userId,
      formId,
      checkInEventId
    );
    event.pdfUri = pdfUri;
    console.log(`Check-in event PDF uploaded: ${pdfUri}`);

    // Transfer inventory (user → warehouse)
    console.log('Transferring check-in items...');
    await inventoryTransferService.transferCheckInEvent(form, event, organizationId);
    console.log('Transfer completed');

    // Compute fullyReturned after this event
    const simulatedForm = { ...form, checkInEvents: [...(form.checkInEvents ?? []), event] };
    const fullyReturned = getOutstandingItems(simulatedForm).length === 0;

    // Persist event on the form
    const updatedForm = await formsAdapter.appendCheckInEvent(
      formId,
      userId,
      organizationId,
      event,
      fullyReturned
    );

    console.log(`Check-in event recorded. Fully returned: ${fullyReturned}`);
    return { status: true, updatedForm, event };
  } catch (error) {
    console.error('Error recording check-in event:', error);
    if (isErrorResponse(error)) throw error;
    if (error instanceof Error && error.message.includes('not found')) {
      throw badRequest(error.message);
    }
    throw internalServerError(
      `Error recording check-in: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};
