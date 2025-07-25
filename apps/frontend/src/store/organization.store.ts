import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import {
  Organization,
  PredefinedForm,
  Product,
  UserAndUserInOrganization,
} from '@equip-track/shared';
import { computed, Signal } from '@angular/core';
import { ApiStatus } from './stores.models';

interface OrganizationState {
  organization: Organization;

  users: UserAndUserInOrganization[];
  products: Product[];
  predefinedForms: PredefinedForm[];

  // Actions state
  updatingProducts: boolean;
  errorUpdatingProducts?: string;

  // Invite user state
  invitingUserStatus: ApiStatus;
  getUsersStatus: ApiStatus;
}

const emptyState: OrganizationState = {
  organization: {
    id: '',
    name: '',
    imageUrl: null,
  },
  users: [],
  products: [],
  predefinedForms: [],
  updatingProducts: false,
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
      organizationId: store.organization.id,
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

      setOrganization(organization: Organization) {
        updateState({ organization });
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
  }),
);
