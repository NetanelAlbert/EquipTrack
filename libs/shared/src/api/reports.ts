import { ItemReport } from '../elements/reports';
import { BasicResponse } from './basic';

export interface GetReportsByDatesRequest {
  dates: string[]; // YYYY-MM-DD format
}

export interface GetReportsByDatesResponse extends BasicResponse {
  reportsByDate: Record<string, ItemReport[]>;
}

export interface ItemReportRequest {
  productId: string;
  upi: string;
  location: string;
}

export interface PublishPartialReportRequest {
  items: ItemReportRequest[];
}

export interface PublishPartialReportResponse extends BasicResponse {
  items: ItemReport[];
}
