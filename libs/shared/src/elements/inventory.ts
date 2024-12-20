export interface InventoryItem {
    productID: string;
    quantity: number;
    upis?: string[];
}

/** DynamoDB table */
export interface Inventory {
    organizationID: string; // Partition key
    userID: string; // Sort key
    items: InventoryItem[];
    lastUpdatedTimeStamp: number;
}