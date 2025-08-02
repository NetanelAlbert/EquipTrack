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
  saveProductStatus: ApiStatus;
  deleteProductStatus: ApiStatus;

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
  saveProductStatus: {
    isLoading: false,
    error: undefined,
  },
  deleteProductStatus: {
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

    const usersMap: Signal<Map<string, UserAndUserInOrganization>> = computed(() => {
      return new Map(
        store.users().map((u) => {
          return [u.user.id, u] as const;
        })
      );
    });

    return {
      productsMap,
      usersMap,
      // Convenience computed properties for loading states
      isLoading: computed(() => 
        store.invitingUserStatus().isLoading ||
        store.getUsersStatus().isLoading ||
        store.getProductsStatus().isLoading ||
        store.saveProductStatus().isLoading ||
        store.deleteProductStatus().isLoading
      ),
    };
  }),
  withMethods((store) => {
    const updateState = (newState: Partial<OrganizationState>) => {
      patchState(store, newState);
    };

    return {
      getUser(id: string): UserAndUserInOrganization | undefined {
        return store.usersMap().get(id);
      },

      getUserName(id?: string): string {
        return id ? this.getUser(id)?.user.name ?? id : '';
      },

      // Computed methods
      getProduct(id: string): Product | undefined {
        return store.productsMap().get(id);
      },

      getProductName(id: string): string {
        return this.getProduct(id)?.name ?? id;
      },
      
      isProductUpi(id: string): boolean {
        return this.getProduct(id)?.hasUpi ?? false;
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

      // Save product state management
      setSaveProductLoading(isLoading: boolean) {
        updateState({
          saveProductStatus: { isLoading, error: undefined },
        });
      },

      setSaveProductSuccess() {
        updateState({
          saveProductStatus: { isLoading: false, error: undefined },
        });
      },

      setSaveProductError(error: string) {
        updateState({
          saveProductStatus: { isLoading: false, error },
        });
      },

      // Delete product state management
      setDeleteProductLoading(isLoading: boolean) {
        updateState({
          deleteProductStatus: { isLoading, error: undefined },
        });
      },

      setDeleteProductSuccess() {
        updateState({
          deleteProductStatus: { isLoading: false, error: undefined },
        });
      },

      setDeleteProductError(error: string) {
        updateState({
          deleteProductStatus: { isLoading: false, error },
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

      // Clear error methods
      clearGetUsersError() {
        updateState({ 
          getUsersStatus: { 
            ...store.getUsersStatus(), 
            error: undefined 
          } 
        });
      },

      clearGetProductsError() {
        updateState({ 
          getProductsStatus: { 
            ...store.getProductsStatus(), 
            error: undefined 
          } 
        });
      },

      clearSaveProductError() {
        updateState({ 
          saveProductStatus: { 
            ...store.saveProductStatus(), 
            error: undefined 
          } 
        });
      },

      clearDeleteProductError() {
        updateState({ 
          deleteProductStatus: { 
            ...store.deleteProductStatus(), 
            error: undefined 
          } 
        });
      },

      clearInvitingUserError() {
        updateState({ 
          invitingUserStatus: { 
            ...store.invitingUserStatus(), 
            error: undefined 
          } 
        });
      },
    };
  })
);
