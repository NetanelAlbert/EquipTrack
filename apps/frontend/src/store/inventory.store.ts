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
    quantity: 20,
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
        // key is productId, value is inventory item
        const items: Record<string, InventoryItem> = {};
        store.wareHouseInventory().forEach((item) => {
          items[item.productId] = item;
        });
        Object.values(store.inventory()).forEach((userItems) => {
          userItems.forEach((item) => {
            if (items[item.productId]) {
              items[item.productId].quantity += item.quantity;
              if (item.upis || items[item.productId].upis) {
                items[item.productId].upis = [
                  ...(items[item.productId].upis ?? []),
                  ...(item.upis ?? []),
                ];
              }
            } else {
              items[item.productId] = item;
            }
          });
        });
        return Object.values(items);
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
              '1': mockInventory,
              '2': mockInventory,
            },
            wareHouseInventory: mockInventory,
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
