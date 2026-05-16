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
    /** Always the parent check-out form's id. */
    formId: string;
    /** Kind of transfer: original check-out or a subsequent check-in (return) event. */
    eventType: 'check-out' | 'check-in';
    /** Identifies the specific CheckInEvent on the form. Only set when eventType === 'check-in'. */
    checkInEventId?: string;
}