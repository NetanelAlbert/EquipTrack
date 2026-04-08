import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  GetReportsByDatesRequest,
  GetReportsByDatesResponse,
  isValidDate,
} from '@equip-track/shared';
import { ReportItem, ReportsAdapter } from '../../../db/tables/reports.adapter';
import {
  badRequest,
  internalServerError,
  isErrorResponse,
  organizationIdRequired,
} from '../../responses';

export async function handler(
  req: GetReportsByDatesRequest,
  pathParams?: APIGatewayProxyEventPathParameters
): Promise<GetReportsByDatesResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw organizationIdRequired;
  }

  if (!req.dates || !Array.isArray(req.dates) || req.dates.length === 0) {
    throw badRequest('Dates array is required and must not be empty');
  }

  const invalidDates = req.dates.filter((date) => !isValidDate(date));
  if (invalidDates.length > 0) {
    throw badRequest(`Invalid dates: ${invalidDates.join(', ')}`);
  }

  const reportsAdapter = new ReportsAdapter();

  try {
    const reportsByDate: Record<string, ReportItem[]> =
      await reportsAdapter.getReportsByDates(organizationId, req.dates);

    return {
      status: true,
      reportsByDate,
    };
  } catch (error) {
    console.error('Error getting reports by dates:', error);
    if (isErrorResponse(error)) {
      throw error;
    }
    throw internalServerError('Failed to get reports by dates');
  }
}
