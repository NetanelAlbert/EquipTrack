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
  User,
  UserRole,
  UserState,
} from '@equip-track/shared';
import { computed, Signal } from '@angular/core';

interface OrganizationState {
  organization: Organization;

  users: User[];
  products: Product[];
  predefinedForms: PredefinedForm[];

  // Actions state
  updatingProducts: boolean;
  errorUpdatingProducts?: string;
}

const mockedOrganization: Organization = {
  id: '123',
  name: 'Hogwarts',
  imageUrl: 'https://via.placeholder.com/150',
};

const mockedProducts: Product[] = [
  {
    id: '1',
    name: 'Broomstick',
    hasUpi: false,
  },
  {
    id: '2',
    name: 'Wand',
    hasUpi: true,
  },
];
const mockedOrganizations: OrganizationState = {
  organization: mockedOrganization,
  products: mockedProducts,
  users: [
    {
      id: '1',
      name: 'Harry Potter',
      email: 'harry@hogwarts.com',
      phone: '1234567890',
      state: UserState.Active,
    },
    {
      id: '2',
      name: 'Hermione Granger',
      email: 'hermione@hogwarts.com',
      phone: '1234567890',
      state: UserState.Active,
    },
  ],
  predefinedForms: [
    {
      organizationID: '123',
      formID: '1',
      description: 'Welcome stuff',
      items: [
        {
          productId: '1',
          quantity: 1,
        },
        {
          productId: '2',
          quantity: 1,
        },
      ],
    },
    {
      organizationID: '123',
      formID: '2',
      description: 'quidditch stuff',
      items: [
        {
          productId: '1',
          quantity: 1,
        },
      ],
    },
  ],
  updatingProducts: false,
  errorUpdatingProducts: undefined,
};

export const OrganizationStore = signalStore(
  { providedIn: 'root' },
  withState(mockedOrganizations), // todo - replace with real data / empty state
  withComputed((store) => {
    const productsMap: Signal<Map<string, Product>> = computed(() => {
      return new Map(
        store.products().map((p) => {
          return [p.id, p] as const;
        })
      );
    });
    return {
      productsMap,
    };
  }),
  withMethods((store) => {
    const updateState = (newState: Partial<OrganizationState>) => {
      patchState(store, (state) => {
        return {
          ...state,
          ...newState,
        };
      });
    };
    return {
      updateState,
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
          updateState({ products });
        } catch (error: unknown) {
          console.error('Error updating products', error);
          // TODO: get error message translation key from api response
          updateState({ errorUpdatingProducts: 'Error updating products' });
        }
        updateState({ updatingProducts: false });
      },
    };
  })
);
