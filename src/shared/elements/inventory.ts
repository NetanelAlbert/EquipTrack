export interface InventoryItem {
    productID: string;
    quantity: number;
    upis?: string[];
}

export interface UserItems {
    userID: string;
    items: InventoryItem[];
}

/** DynamoDB table */
export interface Inventory {
    organizationID: string;
    inWarehouse: InventoryItem[];
    checkedOut: UserItems[];
    lastUpdatedTimeStamp: number;
}