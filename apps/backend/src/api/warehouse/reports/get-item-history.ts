import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  GetItemReportHistoryRequest,
  GetItemReportHistoryResponse,
} from '@equip-track/shared';
import { ReportsAdapter } from '../../../db/tables/reports.adapter';

export async function handler(
  req: GetItemReportHistoryRequest,
  pathParams?: APIGatewayProxyEventPathParameters
): Promise<GetItemReportHistoryResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  if (!req.productId || !req.upi) {
    throw new Error('Product ID and UPI are required');
  }

  const reportsAdapter = new ReportsAdapter();

  try {
    const reportItems = await reportsAdapter.getItemHistory(
      organizationId,
      req.productId,
      req.upi
    );

    return {
      status: true,
      reports: reportItems,
    };
  } catch (error) {
    console.error('Error getting item report history:', error);
    throw new Error('Failed to get item report history');
  }
}
