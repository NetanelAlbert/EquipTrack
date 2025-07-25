import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
  withHooks,
} from '@ngrx/signals';
import {
  User,
  UserRole,
  UserInOrganization,
  InventoryItem,
} from '@equip-track/shared';
import { computed } from '@angular/core';
import { STORAGE_KEYS } from '../utils/consts';

interface UserStoreState {
  // Core user data
  user: User | null;
  userInOrganizations: UserInOrganization[];

  // Current organization selection
  selectedOrganizationId: string | null;

  // User inventory items (moved from old user store)
  checkedOut: InventoryItem[];
}

const emptyState: UserStoreState = {
  user: null,
  userInOrganizations: [],
  selectedOrganizationId: null,
  checkedOut: [],
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

      // User display
      userInitials,
    };
  }),
  withMethods((store) => {
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

      // Set complete auth data
      setAuthData(user: User, userInOrganizations: UserInOrganization[]) {
        updateState({
          user,
          userInOrganizations,
        });
      },

      // Organization selection with enhanced functionality
      selectOrganization(organizationId: string, persistSelection = true) {
        const userOrgRelation = store
          .userInOrganizations()
          .find((uio) => uio.organizationId === organizationId);

        if (!userOrgRelation) {
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

      // Load persisted organization selection with validation
      loadPersistedOrganizationSelection() {
        try {
          const storedOrgId = localStorage.getItem(
            STORAGE_KEYS.SELECTED_ORGANIZATION
          );

          console.log('loadPersistedOrganizationSelection', storedOrgId);

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
        updateState({
          user: null,
          userInOrganizations: [],
          selectedOrganizationId: null,
          checkedOut: [],
        });

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
  }),
  withHooks((store) => {
    return {
      onInit() {
        console.log('user store onInit');
        store.loadPersistedOrganizationSelection();
      },
    };
  })
);
