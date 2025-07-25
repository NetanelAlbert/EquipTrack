import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  FormStatus,
  FormType,
  InventoryForm,
  InventoryItem,
  UserRole,
} from '@equip-track/shared';
import { UserStore } from './user.store';
import { computed, inject } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { OrganizationStore } from './organization.store';

interface FormsState {
  forms: InventoryForm[];
}

const mockedForms: FormsState = {
  forms: [
    {
      userID: '1',
      formID: '1',
      organizationID: '123',
      type: FormType.CheckIn,
      items: [
        {
          productId: '1',
          quantity: 1,
        },
        {
          productId: '2',
          quantity: 2,
          upis: ['123', '456', '789'],
        },
      ],
      status: FormStatus.Pending,
      createdAtTimestamp: Date.now() + 1000 * 60,
      lastUpdated: 1,
    },
    {
      userID: '1',
      formID: '2',
      organizationID: '123',
      type: FormType.CheckOut,
      items: [
        {
          productId: '1',
          quantity: 1,
        },
      ],
      status: FormStatus.Approved,
      createdAtTimestamp: Date.now() + 1000 * 60 * 2,
      approvedAtTimestamp: Date.now() + 1000 * 60 * 3,
      lastUpdated: 2,
    },
    {
      userID: '1',
      formID: '3',
      organizationID: '123',
      type: FormType.CheckIn,
      items: [
        {
          productId: '1',
          quantity: 1,
        },
      ],
      status: FormStatus.Rejected,
      createdAtTimestamp: Date.now() + 1000 * 60 * 2,
      lastUpdated: 3,
    },
  ],
};

export const FormsStore = signalStore(
  { providedIn: 'root' },
  withState(mockedForms),
  withComputed((state) => {
    return {
      checkInForms: computed(() =>
        state
          .forms()
          .filter((form: InventoryForm) => form.type === FormType.CheckIn)
      ),
      checkOutForms: computed(() =>
        state
          .forms()
          .filter((form: InventoryForm) => form.type === FormType.CheckOut)
      ),
    };
  }),
  withMethods((state) => {
    const userStore = inject(UserStore);
    const organizationStore = inject(OrganizationStore);
    return {
      fetchForms() {
        const userRole = userStore.currentRole();
        const userId = userStore.user()?.id;

        if (!userRole || !userId) {
          console.error('User role or ID not available');
          return;
        }

        if ([UserRole.WarehouseManager, UserRole.Admin].includes(userRole)) {
          // TODO: API call to fetch all forms
          patchState(state, {
            forms: [...state.forms()],
          });
        } else {
          console.log('fetching forms for user', userId);
          // TODO: API call to fetch all forms for a user
          patchState(state, {
            forms: [...state.forms()],
          });
        }
      },
      addCheckInForm(items: InventoryItem[]) {
        const userRole = userStore.currentRole();
        const userId = userStore.user()?.id;

        if (!userRole || !userId) {
          console.error('User role or ID not available');
          return;
        }

        const newForm: InventoryForm = {
          userID: userId,
          organizationID: userStore.selectedOrganizationId(),
          type: FormType.CheckIn,
          formID: crypto.randomUUID(),
          items: items,
          status: FormStatus.Pending,
          createdAtTimestamp: Date.now(),
          lastUpdated: Date.now(),
        };
        // TODO: API call to add check-in form

        patchState(state, (state) => {
          return {
            ...state,
            forms: [...state.forms, newForm],
          };
        });
      },
      addCheckOutForm(items: InventoryItem[], userId: string) {
        const newForm: InventoryForm = {
          userID: userId,
          organizationID: userStore.selectedOrganizationId(),
          type: FormType.CheckOut,
          formID: uuidv4(),
          items: items,
          status: FormStatus.Pending,
          createdAtTimestamp: Date.now(),
          lastUpdated: Date.now(),
        };
        // TODO: API call to add check-out form
        patchState(state, {
          forms: [newForm, ...state.forms()],
        });
      },
    };
  })
);
