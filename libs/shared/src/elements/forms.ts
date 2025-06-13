import { InventoryItem } from "./inventory";

export enum FormStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

export enum FormType {
    CheckIn = 'check-in',
    CheckOut = 'check-out',
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
    approvedByUserID?: string;
    signatureURI?: string;
    pdfURI?: string;
    lastUpdated: number;
}

/** DynamoDB table */
export interface PredefinedForm {
    organizationID: string; // partition key
    formID: string; // sort key
    description: string;
    items: InventoryItem[];
}