export interface ItemReport {
    productId: string;
    upi: string;
    location: string;
    reportedBy: string;
    reportedAt?: number;
    // image?
}

export interface InventoryReport {
    date: string; // YYYY-MM-DD for sort
    items: ItemReport[];
}
