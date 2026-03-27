/** Composite map key for productId + upi (productId is a UUID without `_`). */
export function itemReportCompositeKey(productId: string, upi: string): string {
  return `${productId}_${upi}`;
}

export interface ItemReport {
  productId: string;
  upi: string;
  location: string;
  reportedBy: string;
  reportDate?: string;
  /** Current inventory holder (user id or WAREHOUSE); set by backend on publish. */
  ownerUserId?: string;
  /** Department id from holder's org membership; set by backend on publish. */
  departmentId?: string;
  subDepartmentId?: string;
  // image?
}
