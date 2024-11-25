export interface ItemReport {
    productID: string;
    upi: string;
    location: string;
    repotedBy: string;
}

/** DynamoDB table */
export interface InventoryReport {
    organizationID: string;
    date: string;
    items: ItemReport[];
    lastUpdatedTimeStamp: number;
}