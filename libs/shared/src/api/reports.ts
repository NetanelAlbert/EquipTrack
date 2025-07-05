import { ItemReport } from '../elements/reports';
import { BasicResponse } from './basic';

export interface GetReportsResponse extends BasicResponse {
  reportsByDate: Map<string, ItemReport[]>;
}

export interface GetReportsByDatesRequest {
  dates: string[]; // YYYY-MM-DD format
}

export interface GetReportsByDatesResponse extends BasicResponse {
  reportsByDate: Map<string, ItemReport[]>;
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
