import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  GetReportsByDatesRequest,
  GetReportsByDatesResponse,
} from '@equip-track/shared';
import { ReportsAdapter } from '../../db/tables/reports.adapter';
import { InventoryReport, ItemReport } from '@equip-track/shared';

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

  const reportsAdapter = new ReportsAdapter();

  try {
    const reportItems = await reportsAdapter.getReportsByDates({
      organizationId,
      dates: req.dates,
    });

    // Group items by date
    const reportsByDate = new Map<string, ItemReport[]>();

    for (const item of reportItems) {
      if (!reportsByDate.has(item.reportDate)) {
        reportsByDate.set(item.reportDate, []);
      }

      const itemReport: ItemReport = {
        productId: item.productId,
        upi: item.upi,
        location: item.location,
        repotedBy: item.reportedBy,
        reportedAt: item.reportedAt,
      };

      reportsByDate.get(item.reportDate)!.push(itemReport);
    }

    // Convert to InventoryReport format
    const reports: InventoryReport[] = Array.from(reportsByDate.entries()).map(
      ([date, items]) => ({
        date,
        items,
      })
    );

    return {
      status: true,
      reports,
    };
  } catch (error) {
    console.error('Error getting reports by dates:', error);
    throw new Error('Failed to get reports by dates');
  }
}
