import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  User,
  UserRole,
  UserInOrganization,
  InventoryItem,
  Organization,
  Department,
} from '@equip-track/shared';
import { computed, inject } from '@angular/core';
import { STORAGE_KEYS } from '../utils/consts';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import { ApiStatus } from './stores.models';

interface UserStoreState {
  // Core user data
  user: User | null;
  userInOrganizations: UserInOrganization[];
  organizations: Organization[];

  // Current organization selection
  selectedOrganizationId: string;

  // User inventory items (moved from old user store)
  checkedOut: InventoryItem[];

  // Loading state
  startDataStatus: ApiStatus | null;
}

const emptyState: UserStoreState = {
  user: null,
  userInOrganizations: [],
  organizations: [],
  selectedOrganizationId: '',
  checkedOut: [],
  startDataStatus: null,
};

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState(emptyState),
  withComputed((store) => {
    // Get current organization relationship
    const currentUserInOrganization = computed(() => {
      const selectedOrgId = store.selectedOrganizationId();
      if (!selectedOrgId) return null;

      return (
        store
          .userInOrganizations()
          .find((uio) => uio.organizationId === selectedOrgId) || null
      );
    });

    // Current role based on selected organization
    const currentRole = computed(() => {
      const currentUio = currentUserInOrganization();
      return currentUio?.role || null;
    });

    // Organization management
    const hasOrganizations = computed(
      () => store.userInOrganizations().length > 0
    );

    const currentOrganization = computed(() => {
      const selectedOrgId = store.selectedOrganizationId();
      if (!selectedOrgId) return null;

      return (
        store.organizations().find((org) => org.id === selectedOrgId) || null
      );
    });

    // User display properties
    const userInitials = computed(() => {
      const user = store.user();
      if (!user?.name) return '?';

      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    });

    // Enhanced organization computed properties
    const availableOrganizations = store.userInOrganizations;
    const organizationCount = computed(() => availableOrganizations().length);
    const isMultiOrganizationUser = computed(() => organizationCount() > 1);

    // Current organization details
    const currentOrganizationDetails = computed(() => {
      const selectedOrgId = store.selectedOrganizationId();
      if (!selectedOrgId) return null;

      return (
        store
          .userInOrganizations()
          .find((uio) => uio.organizationId === selectedOrgId) || null
      );
    });

    return {
      // Authentication
      currentRole,
      hasOrganizations,

      // Current organization
      currentUserInOrganization,

      // Enhanced organization properties
      availableOrganizations,
      organizationCount,
      isMultiOrganizationUser,
      currentOrganizationDetails,
      currentOrganization,
      // User display
      userInitials,
    };
  }),
  withMethods((store) => {
    const apiService = inject(ApiService);

    const updateState = (newState: Partial<UserStoreState>) => {
      patchState(store, newState);
    };

    return {
      // Set user data (typically after authentication)
      setUser(user: User) {
        updateState({ user });
      },

      // Set user organizations
      setUserInOrganizations(userInOrganizations: UserInOrganization[]) {
        updateState({ userInOrganizations });
      },

      setOrganizations(organizations: Organization[]) {
        updateState({ organizations });
      },

      // Organization selection with enhanced functionality
      selectOrganization(organizationId: string, persistSelection = true) {
        // Validate organization access for non-empty organizationId
        if (organizationId && !this.hasAccessToOrganization(organizationId)) {
          console.error(
            `User does not have access to organization: ${organizationId}`
          );
          return false;
        }

        // Update selected organization
        updateState({ selectedOrganizationId: organizationId });

        // Persist selection if requested
        if (persistSelection) {
          this.persistOrganizationSelection(organizationId);
        }

        console.log('selected organization', organizationId);

        return true;
      },

      // Enhanced persistence with error handling
      persistOrganizationSelection(organizationId: string) {
        try {
          localStorage.setItem(
            STORAGE_KEYS.SELECTED_ORGANIZATION,
            organizationId
          );
          return true;
        } catch (error) {
          console.error('Failed to persist organization selection:', error);
          return false;
        }
      },

      hasAccessToOrganization(organizationId: string) {
        return store
          .userInOrganizations()
          .some((uio) => uio.organizationId === organizationId);
      },

      getDepartmentName(departmentId: string): string | undefined {
        for(const department of store.currentOrganization()?.departments ?? []) {
          if(department.id === departmentId) {
            return department.name;
          }
          for (const subDepartment of department.subDepartments ?? []) {
            if(subDepartment.id === departmentId) {
              return subDepartment.name;
            }
          }
        }
        return undefined;
      },

      // Load persisted organization selection with validation
      loadPersistedOrganizationSelection() {
        try {
          const storedOrgId = localStorage.getItem(
            STORAGE_KEYS.SELECTED_ORGANIZATION
          );

          if (!storedOrgId) return false;

          // Validate user still has access to this organization
          if (this.hasAccessToOrganization(storedOrgId)) {
            updateState({ selectedOrganizationId: storedOrgId });
            return true;
          } else {
            this.clearPersistedOrganizationSelection();
            return false;
          }
        } catch (error) {
          console.error(
            'Failed to load persisted organization selection:',
            error
          );
          return false;
        }
      },

      async loadStartData() {
        updateState({ startDataStatus: { isLoading: true } });
        try {
          const startResponse = await firstValueFrom(
            apiService.endpoints.start.execute(undefined)
          );

          if (!startResponse.status) {
            throw new Error('Failed to load start data');
          }

          updateState({
            user: startResponse.user,
            userInOrganizations: startResponse.userInOrganizations,
            organizations: startResponse.organizations,
            startDataStatus: { isLoading: false },
          });
        } catch (error) {
          console.error('Failed to load start data:', error);
          updateState({
            startDataStatus: { isLoading: false, error: error as string },
          });
        }
      },

      // Clear persisted selection
      clearPersistedOrganizationSelection() {
        try {
          localStorage.removeItem(STORAGE_KEYS.SELECTED_ORGANIZATION);
        } catch (error) {
          console.error(
            'Failed to clear persisted organization selection:',
            error
          );
        }
      },

      // Role checking methods
      hasRole(allowedRoles: UserRole[]): boolean {
        const currentRole = store.currentRole();
        return currentRole ? allowedRoles.includes(currentRole) : false;
      },

      // User inventory management
      setCheckedOut(checkedOut: InventoryItem[]) {
        updateState({ checkedOut });
      },

      addCheckedOutItem(item: InventoryItem) {
        const currentItems = store.checkedOut();
        updateState({ checkedOut: [...currentItems, item] });
      },

      removeCheckedOutItem(productId: string) {
        const currentItems = store.checkedOut();
        updateState({
          checkedOut: currentItems.filter(
            (item) => item.productId !== productId
          ),
        });
      },

      // Clear user data (typically on sign out)
      clearUser() {
        updateState(emptyState);

        // Clear persisted selection
        try {
          this.clearPersistedOrganizationSelection();
        } catch (error) {
          console.error(
            'Failed to clear persisted organization selection:',
            error
          );
        }
      },
    };
  })
);
