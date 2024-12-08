import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { User, InventoryItem } from '@equip-track/shared';
import { computed } from '@angular/core';

type UserState = User & {
  checkedOut: InventoryItem[];
};

const mockedUser: UserState = {
  name: 'Harry Potter',
  email: 'bla@shtut.x',
  id: '123',
  phone: '123456789',
  organizations: [
    {
      organizationID: '123',
      role: 'admin',
    },
  ],
  state: 'active',
  checkedOut: [
    {
      productID: '1',
      quantity: 14,
    },
    {
      productID: '2',
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
    updateState(newState: Partial<User>) {
      patchState(store, (state) => {
        return {
          ...state,
          ...newState,
        };
      });
    },
  }))
);
