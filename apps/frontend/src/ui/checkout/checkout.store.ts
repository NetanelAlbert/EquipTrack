import { signalStore, withState, withMethods, patchState, withComputed } from '@ngrx/signals';
import { InventoryForm, InventoryItem } from '@equip-track/shared';
import { computed, inject } from '@angular/core';
import { FormsStore } from '../../store/forms.store';
import { ApiStatus } from '../../store/stores.models';

interface CheckoutState {
  // API status for operations using ApiStatus
  createCheckoutFormStatus: ApiStatus;
}

const initialState: CheckoutState = {
  createCheckoutFormStatus: {
    isLoading: false,
    error: undefined,
  },
};

export const CheckoutStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    // Convenience computed properties for loading states
    isLoading: computed(() => store.createCheckoutFormStatus().isLoading),
  })),
  withMethods((store) => {
    const formsStore = inject(FormsStore);

    const updateState = (newState: Partial<CheckoutState>) => {
      patchState(store, newState);
    };

    return {
      async createCheckoutForm(userId: string, form: InventoryForm) {
        console.log('createCheckoutForm', userId, form);

        updateState({ 
          createCheckoutFormStatus: { isLoading: true, error: undefined } 
        });

        try {
          // ✅ Use real API through forms store
          await formsStore.addCheckOutForm(form.items, userId);

          updateState({ 
            createCheckoutFormStatus: { isLoading: false, error: undefined } 
          });
        } catch (error) {
          console.error('Failed to create checkout form', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout form';
          updateState({
            createCheckoutFormStatus: { isLoading: false, error: errorMessage },
          });
          throw error;
        }
      },

      // Clear error methods
      clearCreateCheckoutFormError() {
        updateState({ 
          createCheckoutFormStatus: { 
            ...store.createCheckoutFormStatus(), 
            error: undefined 
          } 
        });
      },
    };
  })
);
