import { InventoryItem } from "./inventory";

export interface InventoryForm {
    formID: string;
    items: InventoryItem[];
    status: 'pending' | 'approved' | 'supplied' | 'rejected';
    approvedAtTimestamp?: number;
    signatureURI?: string;
}

/** DynamoDB table */
export interface Forms {
    organizationID: string;
    userID: string;
    checkInForms: InventoryForm[];
    checkOutForms: InventoryForm[];
    checkOutRequests: InventoryForm[];
    lastUpdatedTimeStamp: number;
}
