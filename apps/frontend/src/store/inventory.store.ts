import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { Inventory, InventoryItem } from '@equip-track/shared';
import { computed, inject } from '@angular/core';
import { OrganizationStore } from './organization.store';

type InventoryState = {
  inventory: Inventory[];
  loading: boolean;
  error?: string;
};

const initialState: InventoryState = {
  inventory: [],
  loading: false,
  error: undefined,
};

const mockInventory: Inventory[] = [
  {
    organizationID: '123',
    userID: '1',
    items: [
      {
        productID: '1',
        quantity: 10,
        upis: [],
      },
      {
        productID: '2',
        quantity: 20,
        upis: ['UPIS1', 'UPIS2'],
      },
    ],
    lastUpdatedTimeStamp: Date.now(),
  },
  {
    organizationID: '123',
    userID: 'warehouse-user-id',
    items: [
      {
        productID: '1',
        quantity: 10,
        upis: [],
      },
      {
        productID: '2',
        quantity: 20,
        upis: ['UPIS3', 'UPIS4'],
      },
    ],
    lastUpdatedTimeStamp: Date.now(),
  },
];

export const InventoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const organizationStore = inject(OrganizationStore);
    const allOrganizationInventory = computed(() => {
      const orgID = organizationStore.currentOrganization?.()?.id;
      if (!orgID) return [];
      return store.inventory().filter((inv) => inv.organizationID === orgID);
    });

    return {
      warehouseInventory: computed(() => {
        const warehouseUserID =
          organizationStore.currentOrganization?.()?.warehouseUserID;
        if (!warehouseUserID) return undefined;
        return store.inventory().find((inv) => inv.userID === warehouseUserID);
      }),
      allOrganizationInventory,
      totalOrganizationItems: computed(() => {
        const allItems = new Map<string, InventoryItem>();
        allOrganizationInventory().forEach((inv: Inventory) => {
          inv.items.forEach((item: InventoryItem) => {
            const existing = allItems.get(item.productID);
            if (existing) {
              existing.quantity += item.quantity;
              if (item.upis) {
                existing.upis = [
                  ...(existing.upis || []),
                  ...(item.upis || []),
                ];
              }
            } else {
              allItems.set(item.productID, { ...item });
            }
          });
        });
        return Array.from(allItems.values());
      }),
    };
  }),
  withMethods((store) => {
    const organizationStore = inject(OrganizationStore);
    return {
      async fetchInventory() {
        patchState(store, (state) => ({
          ...state,
          loading: true,
          error: undefined,
        }));
        try {
          const org = organizationStore.currentOrganization?.();
          if (!org) {
            throw new Error('No organization selected');
          }
          patchState(store, (state) => ({
            ...state,
            inventory: mockInventory,
            loading: false,
          }));
        } catch (error) {
          console.error('error fetching inventory', error);
          // TODO: Add error handling
          patchState(store, (state) => ({
            ...state,
            loading: false,
            error: 'Error fetching inventory',
          }));
        }
      },
      getUserInventory(userID: string): Inventory | undefined {
        return store.inventory().find((inv) => inv.userID === userID);
      },
    };
  })
);
