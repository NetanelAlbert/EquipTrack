import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  Forms,
  FormStatus,
  FormType,
  InventoryForm,
  InventoryItem,
} from '@equip-track/shared';
import { UserStore } from './user.store';
import { inject } from '@angular/core';

const initialState: Forms = {
  organizationID: '',
  userID: '',
  checkInForms: [],
  checkOutForms: [],
  lastUpdatedTimeStamp: 0,
};

const mockedForms: Forms = {
  organizationID: '1',
  userID: '1',
  checkInForms: [
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
    },
  ],
  checkOutForms: [],
  lastUpdatedTimeStamp: Date.now(),
};

export const UserFormsStore = signalStore(
  { providedIn: 'root' },
  withState(mockedForms),
  withMethods((state) => {
    const userStore = inject(UserStore);
    return {
      addCheckInForm(items: InventoryItem[]) {
        // TODO: API call to add check-in form
        patchState(state, {
          checkInForms: [
            ...state.checkInForms(),
            {
              userID: userStore.id(),
              organizationID: userStore.activeOrganization.organizationID(),
              type: FormType.CheckIn,
              formID: '1',
              items: items,
              status: FormStatus.PENDING,
              createdAtTimestamp: Date.now(),
            },
          ],
        });
      },
    };
  })
);
