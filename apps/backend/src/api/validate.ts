import { InventoryItem } from '@equip-track/shared';
import { badRequest } from './responses';

export function validate(input: unknown): boolean {
  return true;
}

export function validateInventoryItems(items: InventoryItem[]): void {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw badRequest('Items array is required and must not be empty');
  }

  // Validate each item
  for (const item of items) {
    if (!item.productId || typeof item.productId !== 'string') {
      throw badRequest('Each item must have a valid productId');
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      throw badRequest('Each item must have a positive quantity');
    }
    if (item.upis && !Array.isArray(item.upis)) {
      throw badRequest('UPIs must be an array if provided');
    }
    if (item.upis && item.upis.length > 0) {
      for (const upi of item.upis) {
        if (!upi || typeof upi !== 'string') {
          throw badRequest('Each UPI must be a valid string');
        }
      }
    }
    if (
      item.upis &&
      item.upis.length > 0 &&
      item.upis.length !== item.quantity
    ) {
      throw badRequest('The number of UPIs must match the quantity');
    }
  }
}
