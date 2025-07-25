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
import { computed, Signal, inject, effect } from '@angular/core';
import { ApiStatus } from './stores.models';

interface OrganizationState {
  organization: Organization;

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
  organization: {
    id: '',
    name: '',
    imageUrl: null,
  },
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

    // Enhanced computed properties
    const isOrganizationLoaded = computed(() => !!store.organization().id);
    const hasOrganizationData = computed(
      () => store.users().length > 0 || store.products().length > 0
    );
    const organizationLoadingStatus = computed(() => ({
      isLoading: store.loadingOrganizationData(),
      error: store.errorLoadingOrganization?.() || undefined,
      isLoaded: isOrganizationLoaded(),
      hasData: hasOrganizationData(),
    }));

    return {
      productsMap,
      organizationId: store.organization.id,
      isOrganizationLoaded,
      hasOrganizationData,
      organizationLoadingStatus,
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

      // Enhanced organization loading
      async loadOrganizationData(organizationId: string) {
        if (!organizationId) {
          console.error(
            'Cannot load organization data: No organization ID provided'
          );
          return false;
        }

        // Don't reload if we already have this organization's data
        if (
          store.organization().id === organizationId &&
          store.hasOrganizationData()
        ) {
          return true;
        }

        updateState({
          loadingOrganizationData: true,
          errorLoadingOrganization: undefined,
        });

        try {
          // TODO: Replace with actual API calls when available
          // For now, set basic organization info
          updateState({
            organization: {
              id: organizationId,
              name: `Organization ${organizationId}`,
              imageUrl: null,
            },
            loadingOrganizationData: false,
          });

          console.log(`Loaded organization data for: ${organizationId}`);
          return true;
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to load organization data';
          updateState({
            loadingOrganizationData: false,
            errorLoadingOrganization: errorMessage,
          });
          console.error('Failed to load organization data:', error);
          return false;
        }
      },

      // Switch organization with data loading
      async switchToOrganization(organizationId: string) {
        updateState({ switchingOrganization: true });

        try {
          const success = await this.loadOrganizationData(organizationId);
          updateState({ switchingOrganization: false });
          return success;
        } catch (error) {
          updateState({ switchingOrganization: false });
          console.error('Failed to switch organization:', error);
          return false;
        }
      },

      // Clear organization data (when switching or signing out)
      clearOrganizationData() {
        updateState({
          organization: { id: '', name: '', imageUrl: null },
          users: [],
          products: [],
          predefinedForms: [],
          errorLoadingOrganization: undefined,
        });
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
