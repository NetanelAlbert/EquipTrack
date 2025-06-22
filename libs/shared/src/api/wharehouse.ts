/**
 * To use these APIs, user must have the role 'warehouse'
 */

import {
  InventoryForm,
  PredefinedForm,
  InventoryItem,
  Product,
  ItemReport,
  User,
} from '../elements';
import { BasicResponse } from './basic';

// PRODUCTS
export interface SetProducts {
  products: Product[];
}

// INVENTORY

export interface AddInventory {
  items: InventoryItem[];
}

export interface RemoveInventory {
  items: InventoryItem[];
}

export interface GetInventoryResponse extends BasicResponse {
  warehouse: InventoryItem[];
  users: Map<string, InventoryItem[]>;
  products: Product[];
}

export interface GetUserInventoryResponse extends BasicResponse {
  items: InventoryItem[];
  products: Product[];
}

// CHECK OUT

export interface CreateCheckOutForm {
  items: InventoryItem[];
  userID: string;
}

export interface GetCheckOutFormsResponse extends BasicResponse {
  formsPerUser: Map<string, InventoryForm[]>;
}

// PREDEFINED FORMS

export interface GetPredefinedCheckOutFormResponse {
  forms: PredefinedForm[];
}

export interface AddPredefinedCheckOutForm {
  form: PredefinedForm;
}

export interface DeletePredefinedCheckOutForm {
  formID: string;
}

// CHECK IN

export interface GetCheckInFormsResponse extends BasicResponse {
  formsPerUser: Map<string, InventoryForm[]>;
}

export interface ApproveCheckInForm {
  formID: string;
}

/**
 * POST /api/warehouse/forms/checkIn/reject
 */
export interface RejectCheckInForm {
  formID: string;
  reason: string;
}

// REPORTS

/**
 * GET /api/warehouse/reports/today
 * GET /api/warehouse/reports/<date>
 */
export interface GetTodayReportResponse extends BasicResponse {
  completed: boolean;
  items: ItemReport[];
  usersWithMissingItems: User[];
}

/**
 * GET /api/warehouse/reports/trace/<upi>?goBack=<number>
 */
export interface DayTrace {
  date: string;
  userID: string;
  location: string;
}
export interface GetUPITraceResponse extends BasicResponse {
  trace: DayTrace[];
}
