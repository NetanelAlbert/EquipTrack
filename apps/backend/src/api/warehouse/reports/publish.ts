import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  PublishPartialReportRequest,
  PublishPartialReportResponse,
} from '@equip-track/shared';
import { ReportsAdapter } from '../../db/tables/reports.adapter';

export async function handler(
  req: PublishPartialReportRequest,
  pathParams?: APIGatewayProxyEventPathParameters
): Promise<PublishPartialReportResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  if (!req.date) {
    throw new Error('Date is required');
  }

  if (!req.items || !Array.isArray(req.items) || req.items.length === 0) {
    throw new Error('Items array is required and must not be empty');
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(req.date)) {
    throw new Error('Date must be in YYYY-MM-DD format');
  }

  // Validate items
  for (const item of req.items) {
    if (!item.productId || !item.upi || !item.location || !item.reportedBy) {
      throw new Error(
        'All item fields (productId, upi, location, reportedBy) are required'
      );
    }
  }

  const reportsAdapter = new ReportsAdapter();

  try {
    const publishedCount = await reportsAdapter.publishPartialReport({
      organizationId,
      date: req.date,
      items: req.items,
    });

    return {
      status: true,
      publishedCount,
    };
  } catch (error) {
    console.error('Error publishing partial report:', error);
    throw new Error('Failed to publish partial report');
  }
}
