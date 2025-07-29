import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  PublishPartialReportRequest,
  PublishPartialReportResponse,
  isValidDate,
} from '@equip-track/shared';
import { ReportsAdapter } from '../../../db/tables/reports.adapter';
import { badRequest, internalServerError, ok, SuccessResponse } from '../../responses';

export async function handler(
  req: PublishPartialReportRequest,
  pathParams?: APIGatewayProxyEventPathParameters
): Promise<SuccessResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  if (!req.date) {
    throw badRequest('Date is required');
  }

  if (!req.items || !Array.isArray(req.items) || req.items.length === 0) {
    throw badRequest('Items array is required and must not be empty');
  }

  if (!isValidDate(req.date)) {
    throw badRequest('Date must be in YYYY-MM-DD format');
  }

  // Validate items
  for (const item of req.items) {
    if (!item.productId || !item.upi || !item.location || !item.reportedBy) {
      throw badRequest(
        'All item fields (productId, upi, location, reportedBy) are required'
      );
    }
  }

  const reportsAdapter = new ReportsAdapter();

  try {
    const publishedCount = await reportsAdapter.publishPartialReport(organizationId, req.date, req.items);

    return ok({
      status: true,
      publishedCount,
    });
  } catch (error) {
    console.error('Error publishing partial report:', error);
    // If it's already an error response, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    throw internalServerError('Failed to publish partial report');
  }
}
