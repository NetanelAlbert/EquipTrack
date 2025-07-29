import { InventoryItem } from "../elements/inventory";

export function mergeInventoryItem(
    item1: InventoryItem,
    item2: InventoryItem
  ): InventoryItem {
    if (item1.productId !== item2.productId) {
      throw new Error(
        `Cannot merge inventory items with different product IDs (${item1.productId} and ${item2.productId})`
      );
    }
    return {
      productId: item1.productId,
      quantity: item1.quantity + item2.quantity,
      upis: [...(item1.upis ?? []), ...(item2.upis ?? [])],
    };
  }