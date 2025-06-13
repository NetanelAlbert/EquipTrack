import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Forms, FormStatus, InventoryForm, InventoryItem } from '@equip-track/shared';

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
      formID: '1',
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
  ],
  checkOutForms: [],
  lastUpdatedTimeStamp: Date.now(),
};

export const FormsStore = signalStore(
  { providedIn: 'root' },
  withState(mockedForms),
  withMethods((state) => ({
    addCheckInForm(items: InventoryItem[]) {
      // TODO: API call to add check-in form
      patchState(state, {
        checkInForms: [
          ...state.checkInForms(),
          {
            formID: '1',
            items: items,
            status: FormStatus.PENDING,
            createdAtTimestamp: Date.now(),
          },
        ],
      });
    },
  }))
);
