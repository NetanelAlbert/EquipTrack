import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  User,
  InventoryItem,
  UserRole,
  UserState,
  UserInOrganization,
} from '@equip-track/shared';
import { computed } from '@angular/core';

type UserStoreState = User & UserInOrganization & {
  checkedOut: InventoryItem[];
};

const mockedUser: UserStoreState = {
  name: 'Harry Potter',
  email: 'bla@shtut.x',
  id: '123',
  userId: '123',
  phone: '123456789',
  department: 'Magic',
  departmentRole: 'Wizard',
  organizationId: '123',
  role: UserRole.WarehouseManager,
  state: UserState.Active,
  checkedOut: [
    {
      productId: '1',
      quantity: 14,
    },
    {
      productId: '2',
      quantity: 3,
      upis: ['123', '456', '789'],
    },
  ],
};

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState(mockedUser), // todo - replace with real data / empty state
  withComputed((state) => {
    return {
      isUserActive: computed(() => state.state() === 'active'),
      userInitials: computed(() =>
        state
          .name()
          .split(' ')
          .map((n) => n[0])
          .join('')
      ),
    };
  }),
  withMethods((store) => ({
    updateState(newState: Partial<UserStoreState>) {
      patchState(store, (state) => {
        return {
          ...state,
          ...newState,
        };
      });
    },
  }))
);
