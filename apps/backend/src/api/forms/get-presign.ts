import { BasicUser, ORGANIZATION_ID_PATH_PARAM, USER_ID_PATH_PARAM, UserRole } from "@equip-track/shared";
import { JwtPayload } from "@equip-track/shared";
import { FORM_ID_PATH_PARAM } from "@equip-track/shared";
import { APIGatewayProxyEventPathParameters } from "aws-lambda";
import { badRequest } from "../responses";
import { FormsAdapter } from "../../db/tables/forms.adapter";
import { S3Service } from "../../services/s3.service";

const formsAdapter = new FormsAdapter();
const s3Service = new S3Service();

export const handler = async (
  _req: unknown,
  pathParams: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<BasicUser.GetPresignedUrlResponse> => {
  const organizationId = pathParams?.[ORGANIZATION_ID_PATH_PARAM];
  const formId = pathParams?.[FORM_ID_PATH_PARAM];
  const userId = pathParams?.[USER_ID_PATH_PARAM];

  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  if (!formId) {
    throw badRequest('Form ID is required');
  }

  if(!userId) {
    throw badRequest('User ID is required');
  }

  const form = await formsAdapter.getForm(userId, organizationId, formId);

  const presignedUrl = await s3Service.getPresignedUrl(form.pdfUri);

  return { status: true, presignedUrl };
};