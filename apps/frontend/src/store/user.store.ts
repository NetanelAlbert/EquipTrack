import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Organization, User } from '@equip-track/shared';
import { computed, inject } from '@angular/core';
import { OrganizationStore } from '.';

type UserState = User & {
  currentOrganizationID: string;
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
  currentOrganizationID: '123',
};

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState(mockedUser), // todo - replace with real data / empty state
  withComputed((state) => {
    const organizationStore = inject(OrganizationStore);
    return {
      isUserActive: computed(() => state.state() === 'active'),
      userInitials: computed(() =>
        state
          .name()
          .split(' ')
          .map((n) => n[0])
          .join('')
      ),
      currentOrg: computed<Organization | undefined>(() => {
        console.log('currentOrganizationID', state.currentOrganizationID());
        return organizationStore.get(state.currentOrganizationID());
      }),
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
