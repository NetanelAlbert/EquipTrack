import { InventoryItem } from "./inventory";

export interface InventoryForm {
    formID: string;
    items: InventoryItem[];
    status: 'pending' | 'approved' | 'rejected'; 
    createdAtTimestamp: number;
    approvedAtTimestamp?: number;
    approvedByUserID?: string;
    signatureURI?: string;
    pdfURI?: string;
}

export interface PredefinedForm {
    formID: string;
    description: string;
    items: InventoryItem[];
}

/** DynamoDB table */
export interface Forms {
    organizationID: string; // partition key
    userID: string; // sort key
    checkInForms: InventoryForm[];
    checkOutForms: InventoryForm[];
    lastUpdatedTimeStamp: number;
}
