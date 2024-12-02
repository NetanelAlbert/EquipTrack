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
    products: string[]; // consider moving to a separate table
    inventory: InventoryItem[];
    lastUpdatedTimeStamp: number;
}