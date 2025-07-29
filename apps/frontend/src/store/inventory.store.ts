import {
  signalStore,
  withState,
  withMethods,
  patchState,
  withComputed,
} from '@ngrx/signals';
import {
  InventoryItem,
  ORGANIZATION_ID_PATH_PARAM,
  USER_ID_PATH_PARAM,
} from '@equip-track/shared';
import { computed, inject } from '@angular/core';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { UserStore } from './user.store';
import { firstValueFrom } from 'rxjs';

interface InventoryState {
  // key is userID, value is inventory items for that user
  inventory: Record<string, InventoryItem[]>;
  wareHouseInventory: InventoryItem[];
  loading: boolean;
  error: string | undefined;
  // Add states for add/remove operations
  addingInventory: boolean;
  removingInventory: boolean;
  addInventoryError: string | undefined;
  removeInventoryError: string | undefined;
}

const initialState: InventoryState = {
  inventory: {},
  wareHouseInventory: [],
  loading: false,
  error: undefined,
  addingInventory: false,
  removingInventory: false,
  addInventoryError: undefined,
  removeInventoryError: undefined,
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
    const apiService = inject(ApiService);
    const notificationService = inject(NotificationService);
    const userStore = inject(UserStore);

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
        updateState({ loading: true, error: undefined });
        try {
          const organizationId = userStore.selectedOrganizationId();
          if (!organizationId) {
            throw new Error('No organization selected');
          }

          const inventoryResponse = await firstValueFrom(
            apiService.endpoints.getInventory.execute(undefined, {
              [ORGANIZATION_ID_PATH_PARAM]: organizationId,
            })
          );

          if (!inventoryResponse.status) {
            notificationService.showError(
              'errors.inventory.fetch-failed',
              inventoryResponse.errorMessage
            );
            updateState({
              error: 'Failed to fetch inventory',
              loading: false,
            });
            return;
          }

          // Convert users Map to Record for compatibility with existing code
          const usersInventory: Record<string, InventoryItem[]> = {};
          if (inventoryResponse.items.users) {
            // Handle the users Map from backend response
            Object.entries(inventoryResponse.items.users).forEach(
              ([userId, items]) => {
                usersInventory[userId] = items;
              }
            );
          }

          updateState({
            inventory: usersInventory,
            wareHouseInventory: inventoryResponse.items.warehouse || [],
            loading: false,
          });
        } catch (error) {
          console.error('Error fetching inventory:', error);
          notificationService.handleApiError(
            error,
            'errors.inventory.fetch-failed'
          );
          updateState({
            error: 'Failed to fetch inventory',
            loading: false,
          });
        }
      },

      async fetchUserInventory(userId: string): Promise<InventoryItem[]> {
        try {
          const organizationId = userStore.selectedOrganizationId();
          if (!organizationId) {
            throw new Error('No organization selected');
          }

          const userInventoryResponse = await firstValueFrom(
            apiService.endpoints.getUserInventory.execute(undefined, {
              [ORGANIZATION_ID_PATH_PARAM]: organizationId,
              [USER_ID_PATH_PARAM]: userId,
            })
          );

          if (!userInventoryResponse.status) {
            notificationService.showError(
              'errors.inventory.fetch-failed',
              userInventoryResponse.errorMessage
            );
            throw new Error('Failed to fetch user inventory');
          }

          // Update the specific user's inventory in the store
          updateState({
            inventory: {
              ...store.inventory(),
              [userId]: userInventoryResponse.items || [],
            },
          });

          return userInventoryResponse.items || [];
        } catch (error) {
          console.error('Error fetching user inventory:', error);
          notificationService.handleApiError(
            error,
            'errors.inventory.fetch-failed'
          );
          throw error;
        }
      },

      getUserInventory(userID: string): InventoryItem[] {
        return store.inventory()[userID] ?? [];
      },

      async addInventory(items: InventoryItem[]): Promise<boolean> {
        updateState({
          addingInventory: true,
          addInventoryError: undefined,
        });

        try {
          const organizationId = userStore.selectedOrganizationId();
          if (!organizationId) {
            throw new Error('No organization selected');
          }

          const response = await firstValueFrom(
            apiService.endpoints.addInventory.execute(
              { items },
              {
                [ORGANIZATION_ID_PATH_PARAM]: organizationId,
              }
            )
          );

          if (!response.status) {
            notificationService.showError(
              'errors.inventory.add-failed',
              response.errorMessage
            );
            updateState({
              addInventoryError:
                response.errorMessage || 'Failed to add inventory',
              addingInventory: false,
            });
            return false;
          }

          updateState({ addingInventory: false });
          notificationService.showSuccess(
            'inventory.add.success',
            'Inventory items added successfully'
          );

          // Refresh inventory after successful add
          await this.fetchInventory();

          return true;
        } catch (error) {
          console.error('Error adding inventory:', error);
          notificationService.handleApiError(
            error,
            'errors.inventory.add-failed'
          );
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to add inventory';
          updateState({
            addInventoryError: errorMessage,
            addingInventory: false,
          });
          return false;
        }
      },

      async removeInventory(items: InventoryItem[]): Promise<boolean> {
        updateState({
          removingInventory: true,
          removeInventoryError: undefined,
        });

        try {
          const organizationId = userStore.selectedOrganizationId();
          if (!organizationId) {
            throw new Error('No organization selected');
          }

          const response = await firstValueFrom(
            apiService.endpoints.removeInventory.execute(
              { items },
              {
                [ORGANIZATION_ID_PATH_PARAM]: organizationId,
              }
            )
          );

          if (!response.status) {
            notificationService.showError(
              'errors.inventory.remove-failed',
              response.errorMessage
            );
            updateState({
              removeInventoryError:
                response.errorMessage || 'Failed to remove inventory',
              removingInventory: false,
            });
            return false;
          }

          updateState({ removingInventory: false });
          notificationService.showSuccess(
            'inventory.remove.success',
            'Inventory items removed successfully'
          );

          // Refresh inventory after successful remove
          await this.fetchInventory();

          return true;
        } catch (error) {
          console.error('Error removing inventory:', error);
          notificationService.handleApiError(
            error,
            'errors.inventory.remove-failed'
          );
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to remove inventory';
          updateState({
            removeInventoryError: errorMessage,
            removingInventory: false,
          });
          return false;
        }
      },

      clearAddInventoryError() {
        updateState({ addInventoryError: undefined });
      },

      clearRemoveInventoryError() {
        updateState({ removeInventoryError: undefined });
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
