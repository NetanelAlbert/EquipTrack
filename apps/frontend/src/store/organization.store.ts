import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { Organization, Product } from '@equip-track/shared';
import { computed, Signal } from '@angular/core';

type MinimalOrganization = Pick<Organization, 'id' | 'name' | 'imageURI'>;

type OrganizationState = {
  organizations: Organization[];
  currentOrganization?: Organization;
  updatingProducts: boolean;
  errorUpdatingProducts?: string;
};

const mockedOrganization: Organization = {
  id: '123',
  name: 'Hogwarts',
  imageURI: 'https://via.placeholder.com/150',
  products: [
    {
      id: '1',
      name: 'Broomstick',
      upi: false,
    },
    {
      id: '2',
      name: 'Wand',
      upi: true,
    },
  ],
  lastUpdatedTimeStamp: Date.now(),
};
const mockedOrganizations: OrganizationState = {
  organizations: [mockedOrganization],
  currentOrganization: mockedOrganization,
  updatingProducts: false,
  errorUpdatingProducts: undefined,
};

export const OrganizationStore = signalStore(
  { providedIn: 'root' },
  withState(mockedOrganizations), // todo - replace with real data / empty state
  withComputed((store) => {
    const productsMap: Signal<Map<string, Product>> = computed(() => {
      return new Map(
        store.currentOrganization?.()?.products.map((p) => {
          return [p.id, p] as const;
        })
      );
    });
    return {
      minimalOrganizations: computed<MinimalOrganization[]>(() => {
        return store.organizations().map((o) => {
          const { id, name, imageURI } = o;
          return { id, name, imageURI };
        });
      }),
      products: computed<Product[]>(() => Array.from(productsMap().values())),
      productsMap,
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
        return store.productsMap().get(id);
      },
      async editProducts(products: Product[]) {
        patchState(store, (state) => ({
          ...state,
          updatingProducts: true,
          errorUpdatingProducts: undefined,
        }));
        // todo - call api to update products
        try {
          await new Promise((resolve, reject) => setTimeout(reject, 1000));
          patchState(store, (state) => ({
            ...state,
            currentOrganization: state.currentOrganization
              ? {
                  ...state.currentOrganization,
                  products,
                }
              : undefined,
            updatingProducts: false,
            errorUpdatingProducts: undefined,
          }));
        } catch (error: unknown) {
          console.error('Error updating products', error);
          // TODO: get error message translation key from api response
          patchState(store, (state) => ({
            ...state,
            updatingProducts: false,
            errorUpdatingProducts: 'Error updating products',
          }));
        }
      },
    };
  })
);
