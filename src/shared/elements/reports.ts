export interface ItemReport {
    productID: string;
    upi: string;
    location: string;
    repotedBy: string;
    // image?
}

/** DynamoDB table */
export interface InventoryReport {
    organizationID: string;  // partition key
    date: string; // sort key -- YYYY-MM-DD
    items: ItemReport[];
    lastUpdatedTimeStamp: number;
}
