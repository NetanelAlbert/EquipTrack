import { InventoryItem } from "./inventory";

export interface InventoryForm {
    formID: string;
    items: InventoryItem[];
    status: 'pending' | 'approved' | 'rejected'; 
    approvedAtTimestamp?: number;
    approvedByUserID?: string;
    signatureURI?: string;
}

export interface PredefinedForm {
    formID: string;
    description: string;
    items: InventoryItem[];
}

/** DynamoDB table */
export interface Forms {
    organizationID: string;
    userID: string;
    checkInForms: InventoryForm[];
    checkOutForms: InventoryForm[];
    lastUpdatedTimeStamp: number;
}
