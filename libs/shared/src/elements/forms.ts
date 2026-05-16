import { InventoryItem } from './inventory';

export enum FormStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum FormType {
  CheckOut = 'check-out',
}

/** A single check-in (return) event recorded against an approved check-out form. */
export interface CheckInEvent {
  /** Unique identifier for this event within the form. */
  checkInEventId: string;
  /** Subset of the check-out form's items returned in this event. */
  items: InventoryItem[];
  createdAtTimestamp: number;
  /** ID of the warehouse manager / admin who recorded the return. */
  createdByUserId: string;
  /** S3 presigned-URL key for the check-in event PDF. */
  pdfUri?: string;
}

/** DynamoDB table */
export interface InventoryForm {
  userID: string; // partition key
  formID: string; // sort key
  organizationID: string; // secondary index key
  items: InventoryItem[];
  type: FormType;
  status: FormStatus;
  createdAtTimestamp: number;
  approvedAtTimestamp?: number;
  approvedByUserId?: string;
  pdfUri?: string;
  rejectionReason?: string;
  rejectionAtTimestamp?: number;
  rejectionByUserId?: string;
  lastUpdated: number;
  description?: string;
  createdByUserId?: string;
  /** Recorded check-in (return) events against this check-out form. */
  checkInEvents?: CheckInEvent[];
  /** Set when all originally checked-out items have been returned. */
  fullyReturnedAtTimestamp?: number;
}

/** DynamoDB table */
export interface PredefinedForm {
  organizationID: string; // partition key
  formID: string; // sort key
  description: string;
  items: InventoryItem[];
}

/**
 * Returns the items from a check-out form that have not yet been returned via check-in events.
 * For bulk products the outstanding quantity is the original quantity minus all returned quantities.
 * For UPI products the outstanding UPIs are the originals minus any UPIs already returned.
 */
export function getOutstandingItems(form: InventoryForm): InventoryItem[] {
  const events = form.checkInEvents ?? [];

  const result: InventoryItem[] = [];

  for (const original of form.items) {
    const returnedForProduct = events.flatMap(
      (ev) => ev.items.filter((i) => i.productId === original.productId)
    );

    if (original.upis && original.upis.length > 0) {
      const returnedUpis = new Set(
        returnedForProduct.flatMap((i) => i.upis ?? [])
      );
      const outstandingUpis = original.upis.filter((u) => !returnedUpis.has(u));
      if (outstandingUpis.length > 0) {
        result.push({ productId: original.productId, quantity: outstandingUpis.length, upis: outstandingUpis });
      }
    } else {
      const returnedQty = returnedForProduct.reduce((sum, i) => sum + i.quantity, 0);
      const outstanding = original.quantity - returnedQty;
      if (outstanding > 0) {
        result.push({ productId: original.productId, quantity: outstanding });
      }
    }
  }

  return result;
}

/** Returns true when every item on the check-out form has been returned. */
export function isFullyReturned(form: InventoryForm): boolean {
  return getOutstandingItems(form).length === 0;
}

/**
 * True when at least one check-in (return) event exists on the form.
 * Approved check-outs with none yet are treated as “not returned” in the UI, not partial.
 */
export function hasRecordedReturns(form: InventoryForm): boolean {
  return (form.checkInEvents?.length ?? 0) > 0;
}

/** Return-progress tier for filtering; only meaningful for approved check-out forms. */
export type CheckoutReturnTier = 'not-returned' | 'partially-returned' | 'fully-returned';

/**
 * Classifies an approved check-out form’s return progress for list filters.
 * Non–check-out or non-approved forms yield `undefined` (never match a tier filter).
 */
export function getCheckoutReturnTier(form: InventoryForm): CheckoutReturnTier | undefined {
  if (form.status !== FormStatus.Approved || form.type !== FormType.CheckOut) {
    return undefined;
  }
  if (isFullyReturned(form)) {
    return 'fully-returned';
  }
  if (hasRecordedReturns(form)) {
    return 'partially-returned';
  }
  return 'not-returned';
}
