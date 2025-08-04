import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  ItemReport,
  JwtPayload,
  PublishPartialReportRequest,
  PublishPartialReportResponse,
  formatDateToString,
} from '@equip-track/shared';
import { ReportsAdapter } from '../../../db/tables/reports.adapter';

export async function handler(
  req: PublishPartialReportRequest,
  pathParams?: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<PublishPartialReportResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  if (!req.items || !Array.isArray(req.items) || req.items.length === 0) {
    throw new Error('Items array is required and must not be empty');
  }

  // Validate items
  for (const item of req.items) {
    if (!item.productId || !item.upi || !item.location) {
      throw new Error(
        'All item fields (productId, upi, location) are required'
      );
    }
  }

  if (!jwtPayload) {
    throw new Error('JWT payload is required');
  }

  const userId = jwtPayload.sub;
  const date = formatDateToString(new Date());

  const items: ItemReport[] = req.items.map((item) => ({
    ...item,
    reportedBy: userId,
    reportDate: date,
  }));

  const reportsAdapter = new ReportsAdapter();

  try {
    await reportsAdapter.publishPartialReport(organizationId, date, items);

    return {
      status: true,
      items,
    };
  } catch (error) {
    console.error('Error publishing partial report:', error);
    throw new Error('Failed to publish partial report');
  }
}
