import { InventoryItem } from "./inventory";

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
    products: Product[]; // consider moving to a separate table
    // inventory: InventoryItem[]; needed? its only to validate the data when checking in / out
    lastUpdatedTimeStamp: number;
}