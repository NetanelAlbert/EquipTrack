import { BasicResponse } from './basic';
import { ItemReport } from '../elements/reports';

export interface GetReportsResponse extends BasicResponse {
  reportsByDate: Map<string, ItemReport[]>;
}

export interface GetReportsByDatesRequest {
  dates: string[]; // YYYY-MM-DD format
}

export interface GetReportsByDatesResponse extends BasicResponse {
  reportsByDate: Map<string, ItemReport[]>;
}

export interface PublishReportRequest {
  reportDate: string;
}

export interface PublishReportResponse extends BasicResponse {
  message: string;
}

export interface TraceItemRequest {
  productId: string;
  upi: string;
}

export interface TraceItemResponse extends BasicResponse {
  productId: string;
  upi: string;
  history: ItemReport[];
  currentLocation?: string;
  lastReportedAt?: string;
}
