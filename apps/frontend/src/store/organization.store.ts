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

  // Actions state
  invitingUserStatus: ApiStatus;
  getUsersStatus: ApiStatus;
  getProductsStatus: ApiStatus;

  // Organization switching state
  switchingOrganization: boolean;
}

const emptyState: OrganizationState = {
  users: [],
  products: [],
  predefinedForms: [],
  switchingOrganization: false,
  invitingUserStatus: {
    isLoading: false,
    error: undefined,
  },
  getUsersStatus: {
    isLoading: false,
    error: undefined,
  },
  getProductsStatus: {
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

      // Get products state management
      setGetProductsLoading() {
        updateState({
          getProductsStatus: { isLoading: true, error: undefined },
        });
      },

      setGetProductsSuccess() {
        updateState({
          getProductsStatus: { isLoading: false, error: undefined },
        });
      },

      setGetProductsError(error: string) {
        updateState({
          getProductsStatus: { isLoading: false, error },
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
