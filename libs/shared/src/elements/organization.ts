
export interface Product {
    id: string;
    name: string;
    upi: boolean;    
}

/** DynamoDB table */
export interface Organization {
    id: string; // partition key
    name: string;
    imageURI: string;
    /**
     * A fake user ID for the warehouse inventory.
     * This is used to store the warehouse inventory for the organization.
     * It is not a real user ID, it is just a placeholder.
     */
    warehouseUserID: string;
    products: Product[]; // consider moving to a separate table
    lastUpdatedTimeStamp: number;
}