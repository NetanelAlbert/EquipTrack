export interface ItemReport {
    productId: string;
    upi: string;
    location: string;
    repotedBy: string;
    // image?
}

/** DynamoDB table */
export interface InventoryReport {
    organizationID: string;  // partition key
    date: string; // sort key -- YYYY-MM-DD for sort
    items: ItemReport[];
    lastUpdatedTimeStamp: number;
}
