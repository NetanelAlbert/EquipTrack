import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { GetReportsResponse } from '@equip-track/shared';
import { ReportItem, ReportsAdapter } from '../../../db/tables/reports.adapter';

export async function handler(
  req: undefined,
  pathParams?: APIGatewayProxyEventPathParameters
): Promise<GetReportsResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required');
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

    return {
      status: true,
      reportsByDate,
    };
  } catch (error) {
    console.error('Error getting reports:', error);
    throw new Error('Failed to get reports');
  }
}
