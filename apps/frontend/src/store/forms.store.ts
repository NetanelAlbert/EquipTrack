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
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { UserStore } from './user.store';
import { computed, inject } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { OrganizationStore } from './organization.store';
import { ApiService } from '../services/api.service';
import { firstValueFrom } from 'rxjs';

interface FormsState {
  forms: InventoryForm[];
  loading: boolean;
  error?: string;
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
  loading: false,
  error: undefined,
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
    const apiService = inject(ApiService);

    const updateState = (newState: Partial<FormsState>) => {
      patchState(state, (currentState) => ({
        ...currentState,
        ...newState,
      }));
    };

    return {
      async fetchForms() {
        const userRole = userStore.currentRole();
        const userId = userStore.user()?.id;

        if (!userRole || !userId) {
          console.error('User role or ID not available');
          return;
        }

        updateState({ loading: true, error: undefined });

        try {
          if ([UserRole.WarehouseManager, UserRole.Admin].includes(userRole)) {
            // TODO: API call to fetch all forms (endpoint not yet available)
            // When available, use: await firstValueFrom(apiService.endpoints.getAllForms.execute(...))
            console.log(
              'Fetching all forms for admin/warehouse manager (API not available yet)'
            );
            updateState({
              forms: [...state.forms()],
              loading: false,
            });
          } else {
            console.log('fetching forms for user', userId);
            // TODO: API call to fetch all forms for a user (endpoint not yet available)
            // When available, use: await firstValueFrom(apiService.endpoints.getUserForms.execute(...))
            console.log('Fetching user forms (API not available yet)');
            updateState({
              forms: [...state.forms()],
              loading: false,
            });
          }
        } catch (error) {
          console.error('Error fetching forms:', error);
          updateState({
            error: 'Failed to fetch forms',
            loading: false,
          });
        }
      },

      async addCheckInForm(items: InventoryItem[]) {
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

        // Optimistically update UI
        patchState(state, (currentState) => ({
          ...currentState,
          forms: [...currentState.forms, newForm],
        }));

        try {
          // TODO: API call to add check-in form (backend returns notImplemented)
          // When available, use:
          // await firstValueFrom(apiService.endpoints.requestCheckIn.execute(
          //   { items },
          //   { [ORGANIZATION_ID_PATH_PARAM]: userStore.selectedOrganizationId() }
          // ));
          console.log(
            'Check-in form created locally (API not implemented yet):',
            newForm
          );
        } catch (error) {
          console.error('Error creating check-in form:', error);
          // Revert optimistic update on error
          patchState(state, (currentState) => ({
            ...currentState,
            forms: currentState.forms.filter(
              (form) => form.formID !== newForm.formID
            ),
          }));
          throw error;
        }
      },

      async addCheckOutForm(items: InventoryItem[], userId: string) {
        const organizationId = userStore.selectedOrganizationId();
        if (!organizationId) {
          throw new Error('No organization selected');
        }

        const newForm: InventoryForm = {
          userID: userId,
          organizationID: organizationId,
          type: FormType.CheckOut,
          formID: uuidv4(),
          items: items,
          status: FormStatus.Pending,
          createdAtTimestamp: Date.now(),
          lastUpdated: Date.now(),
        };

        // Optimistically update UI
        patchState(state, {
          forms: [newForm, ...state.forms()],
        });

        try {
          // ✅ API call to add check-out form (IMPLEMENTED)
          const response = await firstValueFrom(
            apiService.endpoints.createCheckOutForm.execute(
              {
                userID: userId,
                items: items,
              },
              {
                [ORGANIZATION_ID_PATH_PARAM]: organizationId,
              }
            )
          );

          if (!response.status) {
            throw new Error(
              response.errorMessage || 'Failed to create checkout form'
            );
          }

          console.log('Checkout form created successfully via API:', newForm);
        } catch (error) {
          console.error('Error creating checkout form:', error);
          // Revert optimistic update on error
          patchState(state, (currentState) => ({
            ...currentState,
            forms: currentState.forms.filter(
              (form) => form.formID !== newForm.formID
            ),
          }));
          throw error;
        }
      },

      async approveForm(formID: string, signature?: string) {
        try {
          // TODO: API call to approve form (backend returns notImplemented)
          // When available, use:
          // await firstValueFrom(apiService.endpoints.approveCheckOut.execute(
          //   { formID, imageData: signature },
          //   { [ORGANIZATION_ID_PATH_PARAM]: userStore.selectedOrganizationId() }
          // ));

          // Optimistically update local state
          patchState(state, (currentState) => ({
            ...currentState,
            forms: currentState.forms.map((form) =>
              form.formID === formID
                ? {
                    ...form,
                    status: FormStatus.Approved,
                    approvedAtTimestamp: Date.now(),
                  }
                : form
            ),
          }));

          console.log(
            'Form approved locally (API not implemented yet):',
            formID
          );
        } catch (error) {
          console.error('Error approving form:', error);
          throw error;
        }
      },

      async rejectForm(formID: string, reason: string) {
        try {
          // TODO: API call to reject form (backend returns notImplemented)
          // When available, use:
          // await firstValueFrom(apiService.endpoints.rejectCheckOut.execute(
          //   { formID, reason },
          //   { [ORGANIZATION_ID_PATH_PARAM]: userStore.selectedOrganizationId() }
          // ));

          // Optimistically update local state
          patchState(state, (currentState) => ({
            ...currentState,
            forms: currentState.forms.map((form) =>
              form.formID === formID
                ? {
                    ...form,
                    status: FormStatus.Rejected,
                    rejectionReason: reason,
                  }
                : form
            ),
          }));

          console.log(
            'Form rejected locally (API not implemented yet):',
            formID,
            reason
          );
        } catch (error) {
          console.error('Error rejecting form:', error);
          throw error;
        }
      },
    };
  })
);
