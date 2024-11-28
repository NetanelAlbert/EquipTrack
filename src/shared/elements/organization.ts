import { InventoryItem } from "./inventory";

export interface User {
    id: string;
    name: string;
    email: string; // needed?
    phone: string;
    organizationRole: string;
    role: 'admin' | 'user' | 'warehouse';
    state: 'active' | 'invited' | 'disabled';
}

export interface Product {
    id: string;
    name: string;
    upi: boolean;    
}

/** DynamoDB table */
export interface Organization {
    id: string;
    name: string;
    imageURI: string;
    users: string[]; // needed? or sabed in IAM? or users table?
    products: string[];
    inventory: InventoryItem[];
    lastUpdatedTimeStamp: number;
}