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

// PRODUCTS

/**
 * POST /api/warehouse/products/set
 */
export interface SertProducts {
  products: Product[];
}

// INVENTORY

/**
 * POST /api/warehouse/inventory/add
 */
export interface AddInventory {
  items: InventoryItem[];
}

/**
 * POST /api/warehouse/inventory/remove
 */
export interface RemoveInventory {
  items: InventoryItem[];
}

/**
 * GET /api/warehouse/inventory/get
 */
export interface GetInventoryResponse {
  items: InventoryItem[];
}

// CHECK OUT

/**
 * POST /api/warehouse/forms/checkOut
 */
export interface CreateCheckOutForm {
  items: InventoryItem[];
  forUserID: string;
}

/**
 * DELETE /api/warehouse/forms/checkOut
 */
export interface DeleteCheckOutForm {
  formID: string;
  userID: string;
}

/**
 * GET /api/warehouse/forms/checkOut/pendings
 */
export interface GetCheckOutFormsResponse {
  formsPerUser: Map<string, InventoryForm[]>;
}

// PREDEFINED FORMS

/**
 * GET /api/warehouse/forms/checkOut/predefined
 */
export interface GetPredefinedCheckOutFormResponse {
  forms: PredefinedForm[];
}

/**
 * POST /api/warehouse/forms/checkOut/predefined
 */
export interface AddPredefinedCheckOutForm {
  form: PredefinedForm;
}

/**
 * DELETE /api/warehouse/forms/checkOut/predefined
 */
export interface DeletePredefinedCheckOutForm {
  formID: string;
}

// CHECK IN

/**
 * GET /api/warehouse/forms/checkIn/pendings
 */
export interface GetCheckInFormsResponse {
  formsPerUser: Map<string, InventoryForm[]>;
}

/**
 * POST /api/warehouse/forms/checkIn/approve
 */
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
export interface GetTodayReportResponse {
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
export interface GetUPITraceResponse {
  trace: DayTrace[];
}
