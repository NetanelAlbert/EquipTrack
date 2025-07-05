import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  GetReportsByDatesRequest,
  GetReportsByDatesResponse,
  isValidDate,
} from '@equip-track/shared';
import { ReportItem, ReportsAdapter } from '../../../db/tables/reports.adapter';

export async function handler(
  req: GetReportsByDatesRequest,
  pathParams?: APIGatewayProxyEventPathParameters
): Promise<GetReportsByDatesResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  if (!req.dates || !Array.isArray(req.dates) || req.dates.length === 0) {
    throw new Error('Dates array is required and must not be empty');
  }

  const invalidDates = req.dates.filter((date) => !isValidDate(date));
  if (invalidDates.length > 0) {
    throw new Error(`Invalid dates: ${invalidDates.join(', ')}`);
  }

  const reportsAdapter = new ReportsAdapter();

  try {
    const reportsByDate: Map<string, ReportItem[]> = await reportsAdapter.getReportsByDates(organizationId, req.dates);

    return {
      status: true,
      reportsByDate,
    };
  } catch (error) {
    console.error('Error getting reports by dates:', error);
    throw new Error('Failed to get reports by dates');
  }
}
