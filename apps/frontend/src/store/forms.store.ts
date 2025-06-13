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
} from '@equip-track/shared';
import { UserStore } from './user.store';
import { computed, inject } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

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
          productID: '1',
          quantity: 1,
        },
        {
          productID: '2',
          quantity: 2,
          upis: ['123', '456', '789'],
        },
      ],
      status: FormStatus.PENDING,
      createdAtTimestamp: Date.now() + 1000 * 60,
      lastUpdated: 1,
    },
    {
      userID: '1',
      formID: '2',
      organizationID: '123',
      type: FormType.CheckIn,
      items: [
        {
          productID: '1',
          quantity: 1,
        },
      ],
      status: FormStatus.APPROVED,
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
          productID: '1',
          quantity: 1,
        },
      ],
      status: FormStatus.REJECTED,
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
    return {
      addCheckInForm(items: InventoryItem[]) {
        const newForm: InventoryForm = {
          userID: userStore.id(),
          organizationID: userStore.activeOrganization.organizationID(),
          type: FormType.CheckIn,
          formID: uuidv4(),
          items: items,
          status: FormStatus.PENDING,
          createdAtTimestamp: Date.now(),
          lastUpdated: Date.now(),
        };
        // TODO: API call to add check-in form
        patchState(state, {
          forms: [newForm, ...state.forms()],
        });
      },
    };
  })
);
