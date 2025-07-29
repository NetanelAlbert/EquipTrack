import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { GetReportsResponse } from '@equip-track/shared';
import { ReportItem, ReportsAdapter } from '../../../db/tables/reports.adapter';
import { badRequest, internalServerError, ok, SuccessResponse } from '../../responses';

export async function handler(
  req: undefined,
  pathParams?: APIGatewayProxyEventPathParameters
): Promise<SuccessResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw badRequest('Organization ID is required');
  }

  const reportsAdapter = new ReportsAdapter();

  try {
    // Get today's date and the last 30 days for a comprehensive report
    const today = new Date();
    const dates: string[] = [];

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    const reportsByDate: Map<string, ReportItem[]> = await reportsAdapter.getReportsByDates(organizationId, dates);    

    return ok({
      status: true,
      reportsByDate,
    });
  } catch (error) {
    console.error('Error getting reports:', error);
    // If it's already an error response, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    throw internalServerError('Failed to get reports');
  }
}
