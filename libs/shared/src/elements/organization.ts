
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
    lastUpdatedTimeStamp: number;
}