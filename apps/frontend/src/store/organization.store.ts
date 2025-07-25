import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import {
  PredefinedForm,
  Product,
  UserAndUserInOrganization,
} from '@equip-track/shared';
import { computed, Signal } from '@angular/core';
import { ApiStatus } from './stores.models';

interface OrganizationState {
  users: UserAndUserInOrganization[];
  products: Product[];
  predefinedForms: PredefinedForm[];

  // Enhanced loading states
  loadingOrganizationData: boolean;
  errorLoadingOrganization?: string;

  // Actions state
  updatingProducts: boolean;
  errorUpdatingProducts?: string;

  // Invite user state
  invitingUserStatus: ApiStatus;
  getUsersStatus: ApiStatus;

  // Organization switching state
  switchingOrganization: boolean;
}

const emptyState: OrganizationState = {
  users: [],
  products: [],
  predefinedForms: [],
  loadingOrganizationData: false,
  updatingProducts: false,
  switchingOrganization: false,
  invitingUserStatus: {
    isLoading: false,
    error: undefined,
  },
  getUsersStatus: {
    isLoading: false,
    error: undefined,
  },
};

export const OrganizationStore = signalStore(
  { providedIn: 'root' },
  withState(emptyState),
  withComputed((store) => {
    const productsMap: Signal<Map<string, Product>> = computed(() => {
      return new Map(
        store.products().map((p) => {
          return [p.id, p] as const;
        })
      );
    });


    return {
      productsMap,
    };
  }),
  withMethods((store) => {
    const updateState = (newState: Partial<OrganizationState>) => {
      patchState(store, newState);
    };

    return {
      // Computed methods
      getProduct(id: string): Product | undefined {
        return store.productsMap().get(id);
      },

      // State setters for services
      setUsers(users: UserAndUserInOrganization[]) {
        updateState({ users });
      },

      setProducts(products: Product[]) {
        updateState({ products });
      },

      // Enhanced error handling
      setOrganizationError(error: string) {
        updateState({
          errorLoadingOrganization: error,
          loadingOrganizationData: false,
        });
      },

      clearOrganizationError() {
        updateState({ errorLoadingOrganization: undefined });
      },

      // Get users state management
      setGetUsersLoading(isLoading: boolean) {
        updateState({
          getUsersStatus: { isLoading, error: undefined },
        });
      },

      setGetUsersSuccess() {
        updateState({
          getUsersStatus: { isLoading: false, error: undefined },
        });
      },

      setGetUsersError(error: string) {
        updateState({
          getUsersStatus: { isLoading: false, error },
        });
      },

      // Update products state management
      setUpdatingProducts(updating: boolean) {
        updateState({
          updatingProducts: updating,
          ...(updating && { errorUpdatingProducts: undefined }),
        });
      },

      setUpdatingProductsSuccess() {
        updateState({
          updatingProducts: false,
          errorUpdatingProducts: undefined,
        });
      },

      setUpdatingProductsError(error: string) {
        updateState({
          updatingProducts: false,
          errorUpdatingProducts: error,
        });
      },

      // Invite user state management
      setInvitingUserLoading(isLoading: boolean) {
        updateState({
          invitingUserStatus: { isLoading, error: undefined },
        });
      },

      setInvitingUserSuccess() {
        updateState({
          invitingUserStatus: { isLoading: false, error: undefined },
        });
      },

      setInvitingUserError(error: string) {
        updateState({
          invitingUserStatus: { isLoading: false, error },
        });
      },
    };
  })
);
