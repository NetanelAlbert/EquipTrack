import { InventoryItem } from './inventory';

export enum FormStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum FormType {
  CheckIn = 'check-in',
  CheckOut = 'check-out',
}

/** DynamoDB table */
export interface InventoryForm {
  userID: string;
  formID: string;
  organizationId: string;
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
}

/** DynamoDB table */
export interface PredefinedForm {
  organizationId: string;
  formID: string;
  description: string;
  items: InventoryItem[];
}
