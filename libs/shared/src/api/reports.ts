import { ItemReport } from '../elements/reports';
import { BasicResponse } from './basic';
import { InventoryItem } from '../elements/inventory';

export interface GetReportsByDatesRequest {
  dates: string[]; // YYYY-MM-DD format
}

export interface GetItemsToReportRequestResponse extends BasicResponse {
  itemsByHolder: Record<string, InventoryItem[]>;
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

export interface GetItemReportHistoryRequest {
  productId: string;
  upi: string;
}

export interface GetItemReportHistoryResponse extends BasicResponse {
  reports: ItemReport[];
}
