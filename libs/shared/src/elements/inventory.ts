export interface InventoryItem {
    productId: string;
    quantity: number;
    upis?: string[];
}

/** Record of a UPI holder change (stored on the unique inventory item row). */
export interface OwnershipEvent {
    previousHolderId: string;
    newHolderId: string;
    /** Epoch milliseconds */
    timestamp: number;
    formId: string;
    formType: 'check-in' | 'check-out';
}