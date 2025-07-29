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
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { firstValueFrom } from 'rxjs';

interface FormsState {
  forms: InventoryForm[];
  loading: boolean;
  error?: string;
}

const emptyState: FormsState = {
  forms: [],
  loading: false,
  error: undefined,
};

export const FormsStore = signalStore(
  { providedIn: 'root' },
  withState(emptyState),
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
    const apiService = inject(ApiService);
    const notificationService = inject(NotificationService);

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
            console.log(
              'Fetching all forms for admin/warehouse manager (API not available yet)'
            );
            const response = await firstValueFrom(
              apiService.endpoints.getAllForms.execute(undefined, {
                [ORGANIZATION_ID_PATH_PARAM]:
                  userStore.selectedOrganizationId(),
              })
            );
            if (!response.status) {
              notificationService.showError(
                'errors.forms.fetch-failed',
                response.errorMessage
              );
              updateState({ error: 'Failed to fetch forms', loading: false });
              return;
            }
            updateState({ forms: response.forms, loading: false });
          } else {
            console.log('fetching forms for user', userId);
            const response = await firstValueFrom(
              apiService.endpoints.getUserForms.execute(undefined, {
                [ORGANIZATION_ID_PATH_PARAM]:
                  userStore.selectedOrganizationId(),
              })
            );
            if (!response.status) {
              notificationService.showError(
                'errors.forms.fetch-failed',
                response.errorMessage
              );
              updateState({ error: 'Failed to fetch forms', loading: false });
              return;
            }
            updateState({ forms: response.forms, loading: false });
          }
        } catch (error) {
          console.error('Error fetching forms:', error);
          notificationService.handleApiError(
            error,
            'errors.forms.fetch-failed'
          );
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
          const response = await firstValueFrom(
            apiService.endpoints.requestCheckIn.execute(
              { items },
              {
                [ORGANIZATION_ID_PATH_PARAM]:
                  userStore.selectedOrganizationId(),
              }
            )
          );

          if (!response.status) {
            notificationService.showError(
              'errors.forms.submit-failed',
              response.errorMessage
            );
            // Revert optimistic update on error
            patchState(state, (currentState) => ({
              ...currentState,
              forms: currentState.forms.filter(
                (form) => form.formID !== newForm.formID
              ),
            }));
            return;
          }

          console.log('Check-in form submitted successfully:', newForm);
          notificationService.showSuccess(
            'forms.check-in-submitted',
            'Check-in request submitted successfully'
          );
        } catch (error) {
          console.error('Error creating check-in form:', error);
          notificationService.handleApiError(
            error,
            'errors.forms.submit-failed'
          );
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
            notificationService.showError(
              'errors.forms.submit-failed',
              response.errorMessage
            );
            // Revert optimistic update on error
            patchState(state, (currentState) => ({
              ...currentState,
              forms: currentState.forms.filter(
                (form) => form.formID !== newForm.formID
              ),
            }));
            return;
          }

          console.log('Checkout form created successfully via API:', newForm);
          notificationService.showSuccess(
            'forms.check-out-submitted',
            'Check-out request submitted successfully'
          );
        } catch (error) {
          console.error('Error creating checkout form:', error);
          notificationService.handleApiError(
            error,
            'errors.forms.submit-failed'
          );
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

      async approveForm(formID: string, signature: string) {
        try {
          // Call the backend API to approve the form
          const response = await firstValueFrom(
            apiService.endpoints.approveForm.execute(
              {
                formID,
                signature,
              },
              {
                [ORGANIZATION_ID_PATH_PARAM]:
                  userStore.selectedOrganizationId(),
              }
            )
          );

          if (!response.status) {
            notificationService.showError(
              'errors.forms.approve-failed',
              response.errorMessage
            );
            return;
          }

          // Optimistically update local state on success
          patchState(state, {
            forms: state
              .forms()
              .map((form) =>
                form.formID === formID ? response.updatedForm : form
              ),
          });

          console.log('Form approved successfully:', formID);
          notificationService.showSuccess(
            'forms.form-approved',
            'Form approved successfully'
          );
        } catch (error) {
          console.error('Error approving form:', error);
          notificationService.handleApiError(
            error,
            'errors.forms.approve-failed'
          );
          throw error;
        }
      },

      async rejectForm(formID: string, reason: string) {
        try {
          // Call the backend API to reject the form
          const response = await firstValueFrom(
            apiService.endpoints.rejectForm.execute(
              { formID, reason },
              {
                [ORGANIZATION_ID_PATH_PARAM]:
                  userStore.selectedOrganizationId(),
              }
            )
          );

          if (!response.status) {
            notificationService.showError(
              'errors.forms.reject-failed',
              response.errorMessage
            );
            return;
          }

          // Optimistically update local state on success
          patchState(state, (currentState) => ({
            ...currentState,
            forms: currentState.forms.map((form) =>
              form.formID === formID
                ? {
                    ...form,
                    status: FormStatus.Rejected,
                    rejectionReason: reason,
                    lastUpdated: Date.now(),
                  }
                : form
            ),
          }));

          console.log('Form rejected successfully:', formID, reason);
          notificationService.showSuccess(
            'forms.form-rejected',
            'Form rejected successfully'
          );
        } catch (error) {
          console.error('Error rejecting form:', error);
          notificationService.handleApiError(
            error,
            'errors.forms.reject-failed'
          );
          throw error;
        }
      },
    };
  })
);
