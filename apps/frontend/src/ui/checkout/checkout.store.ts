import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { InventoryForm, InventoryItem } from '@equip-track/shared';

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
  withMethods((store) => ({
    async createCheckoutForm(userId: string, form: InventoryForm) {
      console.log('createCheckoutForm', userId, form);
      // TODO: Replace with actual API call

      patchState(store, { sending: true });
      try {
        // TODO: Replace with actual API call
        await new Promise((resolve, reject) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Failed to create checkout form', error);
        patchState(store, { error: 'Failed to create checkout form' });
      } finally {
        patchState(store, { sending: false });
      }
    },
  }))
);
