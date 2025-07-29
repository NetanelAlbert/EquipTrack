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
import { ApiStatus } from './stores.models';
import { mergeInventoryItem } from '@equip-track/shared';

interface InventoryState {
  // key is userID, value is inventory items for that user
  inventory: Record<string, InventoryItem[]>;
  wareHouseInventory: InventoryItem[];
  totalInventory: InventoryItem[];

  // API status for operations using ApiStatus
  fetchInventoryStatus: ApiStatus;
  fetchUserInventoryStatus: ApiStatus;
  addInventoryStatus: ApiStatus;
  removeInventoryStatus: ApiStatus;
}

const initialState: InventoryState = {
  inventory: {},
  wareHouseInventory: [],
  totalInventory: [],
  fetchInventoryStatus: {
    isLoading: false,
    error: undefined,
  },
  fetchUserInventoryStatus: {
    isLoading: false,
    error: undefined,
  },
  addInventoryStatus: {
    isLoading: false,
    error: undefined,
  },
  removeInventoryStatus: {
    isLoading: false,
    error: undefined,
  },
};

export const InventoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    return {
      // Convenience computed properties for loading states
      isLoading: computed(
        () =>
          store.fetchInventoryStatus().isLoading ||
          store.fetchUserInventoryStatus().isLoading ||
          store.addInventoryStatus().isLoading ||
          store.removeInventoryStatus().isLoading
      ),
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
      async fetchTotalInventory() {
        updateState({
          fetchInventoryStatus: { isLoading: true, error: undefined },
        });

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
              inventoryResponse.errorKey ?? 'errors.inventory.fetch-failed',
              inventoryResponse.errorMessage ?? 'Failed to fetch inventory'
            );
            updateState({
              fetchInventoryStatus: {
                isLoading: false,
                error:
                  inventoryResponse.errorMessage ?? 'Failed to fetch inventory',
              },
            });
            return;
          }

          updateState({
            totalInventory: inventoryResponse.totalItems,
            fetchInventoryStatus: { isLoading: false, error: undefined },
          });
        } catch (error) {
          console.error('Error fetching inventory:', error);
          notificationService.handleApiError(
            error,
            'errors.inventory.fetch-failed'
          );
          updateState({
            fetchInventoryStatus: {
              isLoading: false,
              error: 'Failed to fetch inventory',
            },
          });
        }
      },

      async fetchUserInventory(userId: string): Promise<InventoryItem[]> {
        updateState({
          fetchUserInventoryStatus: { isLoading: true, error: undefined },
        });

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
            updateState({
              fetchUserInventoryStatus: {
                isLoading: false,
                error: 'Failed to fetch user inventory',
              },
            });
            throw new Error('Failed to fetch user inventory');
          }

          // Update the specific user's inventory in the store
          updateState({
            inventory: {
              ...store.inventory(),
              [userId]: userInventoryResponse.items || [],
            },
            fetchUserInventoryStatus: { isLoading: false, error: undefined },
          });

          return userInventoryResponse.items || [];
        } catch (error) {
          console.error('Error fetching user inventory:', error);
          notificationService.handleApiError(
            error,
            'errors.inventory.fetch-failed'
          );
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to fetch user inventory';
          updateState({
            fetchUserInventoryStatus: {
              isLoading: false,
              error: errorMessage,
            },
          });
          throw error;
        }
      },

      getUserInventory(userID: string): InventoryItem[] {
        return store.inventory()[userID] ?? [];
      },

      async addInventory(items: InventoryItem[]): Promise<boolean> {
        updateState({
          addInventoryStatus: { isLoading: true, error: undefined },
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
              addInventoryStatus: {
                isLoading: false,
                error: response.errorMessage || 'Failed to add inventory',
              },
            });
            return false;
          }

          updateState({
            addInventoryStatus: { isLoading: false, error: undefined },
          });
          notificationService.showSuccess(
            'inventory.add.success',
            'Inventory items added successfully'
          );

          // Refresh inventory after successful add
          await this.fetchTotalInventory();

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
            addInventoryStatus: { isLoading: false, error: errorMessage },
          });
          return false;
        }
      },

      async removeInventory(items: InventoryItem[]): Promise<boolean> {
        updateState({
          removeInventoryStatus: { isLoading: true, error: undefined },
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
              removeInventoryStatus: {
                isLoading: false,
                error: response.errorMessage || 'Failed to remove inventory',
              },
            });
            return false;
          }

          updateState({
            removeInventoryStatus: { isLoading: false, error: undefined },
          });
          notificationService.showSuccess(
            'inventory.remove.success',
            'Inventory items removed successfully'
          );

          // Refresh inventory after successful remove
          await this.fetchTotalInventory();

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
            removeInventoryStatus: { isLoading: false, error: errorMessage },
          });
          return false;
        }
      },

      // Clear error methods
      clearFetchInventoryError() {
        updateState({
          fetchInventoryStatus: {
            ...store.fetchInventoryStatus(),
            error: undefined,
          },
        });
      },

      clearFetchUserInventoryError() {
        updateState({
          fetchUserInventoryStatus: {
            ...store.fetchUserInventoryStatus(),
            error: undefined,
          },
        });
      },

      clearAddInventoryError() {
        updateState({
          addInventoryStatus: {
            ...store.addInventoryStatus(),
            error: undefined,
          },
        });
      },

      clearRemoveInventoryError() {
        updateState({
          removeInventoryStatus: {
            ...store.removeInventoryStatus(),
            error: undefined,
          },
        });
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
