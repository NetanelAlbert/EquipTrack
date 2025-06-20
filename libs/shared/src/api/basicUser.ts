import { InventoryItem, ItemReport } from '../elements';
import { BasicResponse } from './basic';

export interface StartResponse extends BasicResponse {
  /* Todo: add here all the data needed for the app to start
   * - user data
   * - organization data
   * - inventory data
   * - forms data
   * - reports data
   */
  dummyData: string; // todo remove this. only for lint
}

export interface ApproveCheckOut {
  formID: string;
  imageData: Blob; // todo check if this is correct
}

export interface RejectCheckOut {
  formID: string;
  reason: string;
}

export interface RequestCheckIn {
  items: InventoryItem[];
}

export interface ReportItems {
  items: ItemReport[];
}
