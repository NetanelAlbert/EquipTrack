import { InventoryReport } from '../elements/reports';
import { BasicResponse } from './basic';

export interface GetReportsResponse extends BasicResponse {
  reports: InventoryReport[];
}

export interface GetReportsByDatesRequest {
  dates: string[]; // YYYY-MM-DD format
}

export interface GetReportsByDatesResponse extends BasicResponse {
  reports: InventoryReport[];
}

export interface PublishPartialReportRequest {
  date: string; // YYYY-MM-DD format
  items: {
    productId: string;
    upi: string;
    location: string;
    reportedBy: string;
  }[];
}

export interface PublishPartialReportResponse extends BasicResponse {
  publishedCount: number;
}
