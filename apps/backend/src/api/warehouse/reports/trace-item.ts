import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  TraceItemRequest,
  TraceItemResponse,
  ItemReport,
} from '@equip-track/shared';
import { ReportsAdapter } from '../../../db/tables/reports.adapter';

export async function handler(
  req: TraceItemRequest,
  pathParams?: APIGatewayProxyEventPathParameters
): Promise<TraceItemResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  if (!req.productId) {
    throw new Error('Product ID is required');
  }

  if (!req.upi) {
    throw new Error('UPI is required');
  }

  const reportsAdapter = new ReportsAdapter();

  try {
    const history = await reportsAdapter.getItemHistory(
      organizationId,
      req.productId,
      req.upi
    );

    return {
      status: true,
      productId: req.productId,
      upi: req.upi,
      history,
      currentLocation: history.length > 0 ? history[0].location : undefined,
      lastReportedAt: history.length > 0 ? history[0].reportDate : undefined,
    };
  } catch (error) {
    console.error('Error tracing item:', error);
    throw new Error('Failed to trace item');
  }
}