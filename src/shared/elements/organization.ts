export interface User {
    id: string;
    name: string;
    email: string;
    phone: string;
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
    users: string[];
    products: string[];
    lastUpdatedTimeStamp: number;
}