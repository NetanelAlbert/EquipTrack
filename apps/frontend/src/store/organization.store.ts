import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { Organization, Product } from '@equip-track/shared';
import { computed } from '@angular/core';

type MinimalOrganization = Pick<Organization, 'id' | 'name' | 'imageURI'>;

type OrganizationState = {
  organizations: Organization[];
  currentOrganization?: Organization;
};

const mockedOrganization = {
  id: '123',
  name: 'Hogwarts',
  imageURI: 'https://via.placeholder.com/150',
  products: [{
    id: '1',
    name: 'Broomstick',
    upi: false,
  }, {
    id: '2',
    name: 'Wand',
    upi: true,
  }],
  lastUpdatedTimeStamp: Date.now(),
};
const mockedOrganizations: OrganizationState = {
  organizations: [mockedOrganization],
  currentOrganization: mockedOrganization,
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
  withMethods((store) => {
    const get = (id: string): Organization | undefined => {
      return store.organizations().find((o) => o.id === id);
    };
    return {
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
      get,
      setCurrent(id: string) {
        patchState(store, (state) => {
          return {
            ...state,
            currentOrganization: get(id),
          };
        });
      },
      getProduct(id: string): Product | undefined {
        return store.currentOrganization?.()?.products.find((p) => p.id === id);
      },
    };
  })
);
