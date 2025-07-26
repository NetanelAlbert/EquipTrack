import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { InventoryForm, InventoryItem } from '@equip-track/shared';
import { inject } from '@angular/core';
import { FormsStore } from '../../store/forms.store';

interface CheckoutState {
  sending: boolean;
  error: string | undefined;
}

const initialState: CheckoutState = {
  sending: false,
  error: undefined,
};

export const CheckoutStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const formsStore = inject(FormsStore);

    return {
      async createCheckoutForm(userId: string, form: InventoryForm) {
        console.log('createCheckoutForm', userId, form);

        patchState(store, { sending: true, error: undefined });

        try {
          // ✅ Use real API through forms store
          await formsStore.addCheckOutForm(form.items, userId);

          patchState(store, { sending: false });
        } catch (error) {
          console.error('Failed to create checkout form', error);
          patchState(store, {
            error: 'Failed to create checkout form',
            sending: false,
          });
          throw error;
        }
      },
    };
  })
);
