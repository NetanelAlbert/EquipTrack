import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import { GetReportsResponse } from '@equip-track/shared';
import { ReportsAdapter } from '../../db/tables/reports.adapter';
import { InventoryReport, ItemReport } from '@equip-track/shared';

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

    const reportItems = await reportsAdapter.getReportsByDates({
      organizationId,
      dates,
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

    // Convert to InventoryReport format and sort by date (newest first)
    const reports: InventoryReport[] = Array.from(reportsByDate.entries())
      .map(([date, items]) => ({
        date,
        items,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      status: true,
      reports,
    };
  } catch (error) {
    console.error('Error getting reports:', error);
    throw new Error('Failed to get reports');
  }
}
