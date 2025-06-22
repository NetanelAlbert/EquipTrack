import {
  signalStore,
  withState,
  withMethods,
  patchState,
  withComputed,
} from '@ngrx/signals';
import { InventoryItem } from '@equip-track/shared';
import { computed } from '@angular/core';

interface InventoryState {
  // key is userID, value is inventory items for that user
  inventory: Record<string, InventoryItem[]>;
  wareHouseInventory: InventoryItem[];
  loading: boolean;
  error?: string;
}

const mockInventory: InventoryItem[] = [
  {
    productId: '1',
    quantity: 10,
    upis: [],
  },
  {
    productId: '2',
    quantity: 2,
    upis: ['UPIS1', 'UPIS2'],
  },
];

const initialState: InventoryState = {
  inventory: {},
  wareHouseInventory: [],
  loading: false,
  error: undefined,
};

export const InventoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    return {
      totalOrganizationItems: computed<InventoryItem[]>(() => {
        const usersItems = Object.values(store.inventory()).flat();
        const warehouseItems = store.wareHouseInventory();
        return mergeInventoryItems([...usersItems, ...warehouseItems]);
      }),
    };
  }),
  withMethods((store) => {
    const updateState = (newState: Partial<InventoryState>) => {
      patchState(store, (state) => {
        return {
          ...state,
          ...newState,
        };
      });
    };
    return {
      async fetchInventory() {
        updateState({ loading: true });
        try {
          updateState({
            inventory: {
              '1': [...mockInventory],
              '2': [...mockInventory],
            },
            wareHouseInventory: [...mockInventory],
          });
        } catch (error) {
          console.error('error fetching inventory', error);
          // TODO: Add error handling
          updateState({ error: 'Error fetching inventory' });
        }
        updateState({ loading: false });
      },
      getUserInventory(userID: string): InventoryItem[] {
        return store.inventory()[userID] ?? [];
      },
    };
  })
);

function mergeInventoryItems(items: InventoryItem[]): InventoryItem[] {
  const mergedItems: Record<string, InventoryItem> = {};
  items.forEach((item) => {
    if (mergedItems[item.productId]) {
      mergedItems[item.productId] = mergeInventoryItem(
        mergedItems[item.productId],
        item
      );
    } else {
      mergedItems[item.productId] = item;
    }
  });
  return Object.values(mergedItems);
}

function mergeInventoryItem(
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
