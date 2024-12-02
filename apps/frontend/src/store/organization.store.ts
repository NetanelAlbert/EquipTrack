import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { Organization } from '@equip-track/shared';
import { computed } from '@angular/core';

type MinimalOrganization = Pick<Organization, 'id' | 'name' | 'imageURI'>;

type OrganizationState = { organizations: Organization[] };

const mockedOrganizations: OrganizationState = {
  organizations: [
    {
      id: '123',
      name: 'Hogwarts',
      imageURI: 'https://via.placeholder.com/150',
      products: [],
      lastUpdatedTimeStamp: Date.now(),
    },
  ],
};

export const OrganizationStore = signalStore(
  { providedIn: 'root' },
  withState(mockedOrganizations), // todo - replace with real data / empty state
  withComputed((store) => {
    return {
      minimalOrganizations: computed<MinimalOrganization[]>(() => {
        return store.organizations().map((o) => {
          const { id, name, imageURI } = o;
          return { id, name, imageURI };
        });
      }),
    };
  }),
  withMethods((store) => ({
    updateState(newState: Partial<Organization>) {
      patchState(store, (state) => {
        return {
          ...state,
          ...newState,
        };
      });
    },
    add(o: Organization) {
      patchState(store, (state) => {
        return {
          ...state,
          organizations: [...state.organizations, o],
        };
      });
    },
    get(id: string): Organization | undefined {
      return store.organizations().find((o) => o.id === id);
    },
  }))
);
