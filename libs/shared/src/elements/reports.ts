const ITEM_REPORT_KEY_SEP = '\u001f';

/**
 * Stable composite key for productId + upi (neither field may contain this separator).
 */
export function itemReportCompositeKey(productId: string, upi: string): string {
  return `${productId}${ITEM_REPORT_KEY_SEP}${upi}`;
}

/** Split a key from {@link itemReportCompositeKey}; returns null if malformed. */
export function parseItemReportCompositeKey(
  key: string
): { productId: string; upi: string } | null {
  const i = key.indexOf(ITEM_REPORT_KEY_SEP);
  if (i === -1) {
    return null;
  }
  return { productId: key.slice(0, i), upi: key.slice(i + ITEM_REPORT_KEY_SEP.length) };
}

export interface ItemReport {
  productId: string;
  upi: string;
  location: string;
  reportedBy: string;
  reportDate?: string;
  /** ISO-8601 timestamp for the specific report submission time. */
  reportTimestamp?: string;
  /** Current inventory holder (user id or WAREHOUSE); set by backend on publish. */
  ownerUserId?: string;
  /** Department id from holder's org membership; set by backend on publish. */
  departmentId?: string;
  subDepartmentId?: string;
  // image?
}
