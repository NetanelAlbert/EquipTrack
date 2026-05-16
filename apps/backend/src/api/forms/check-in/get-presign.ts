import {
  BasicUser,
  CHECK_IN_EVENT_ID_PATH_PARAM,
  FORM_ID_PATH_PARAM,
  ORGANIZATION_ID_PATH_PARAM,
  USER_ID_PATH_PARAM,
} from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { FormsAdapter } from '../../../db/tables/forms.adapter';
import { S3Service } from '../../../services/s3.service';
import {
  badRequest,
  formIdRequired,
  organizationIdRequired,
  userIdRequired,
} from '../../responses';

const formsAdapter = new FormsAdapter();
const s3Service = new S3Service();

export const handler = async (
  _req: unknown,
  pathParams: APIGatewayProxyEventPathParameters
): Promise<BasicUser.GetPresignedUrlResponse> => {
  const organizationId = pathParams?.[ORGANIZATION_ID_PATH_PARAM];
  if (!organizationId) throw organizationIdRequired;

  const formId = pathParams?.[FORM_ID_PATH_PARAM];
  if (!formId) throw formIdRequired;

  const userId = pathParams?.[USER_ID_PATH_PARAM];
  if (!userId) throw userIdRequired;

  const checkInEventId = pathParams?.[CHECK_IN_EVENT_ID_PATH_PARAM];
  if (!checkInEventId) throw badRequest('Check-in event ID is required');

  const form = await formsAdapter.getForm(userId, organizationId, formId);
  const checkInEvent = form?.checkInEvents?.find(
    (e) => e.checkInEventId === checkInEventId
  );

  if (!checkInEvent?.pdfUri) {
    throw badRequest(`PDF not available for check-in event ${checkInEventId}`);
  }

  const presignedUrl = await s3Service.getPresignedUrl(checkInEvent.pdfUri);
  return { status: true, presignedUrl };
};
