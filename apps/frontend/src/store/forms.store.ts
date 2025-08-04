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
  USER_ID_PATH_PARAM,
  FORM_ID_PATH_PARAM,
} from '@equip-track/shared';
import { UserStore } from './user.store';
import { computed, inject } from '@angular/core';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { firstValueFrom } from 'rxjs';
import { ApiStatus } from './stores.models';
import { Router } from '@angular/router';
import { getPresignedUrlTTL } from '@equip-track/shared';
import { FormQueryParams } from '../utils/forms.medels';
import { TranslateService } from '@ngx-translate/core';

interface PresignedUrl {
  url: string;
  ttl: number;
}

interface FormsState {
  forms: InventoryForm[];
  presignedUrls: Record<string, PresignedUrl>;

  // API status for operations using ApiStatus
  fetchFormsStatus: ApiStatus;
  addFormStatus: ApiStatus;
  approveFormStatus: ApiStatus;
  rejectFormStatus: ApiStatus;
  getPresignedUrlStatus: ApiStatus;
}

const emptyState: FormsState = {
  forms: [],
  presignedUrls: {},
  fetchFormsStatus: {
    isLoading: false,
    error: undefined,
  },
  addFormStatus: {
    isLoading: false,
    error: undefined,
  },
  approveFormStatus: {
    isLoading: false,
    error: undefined,
  },
  rejectFormStatus: {
    isLoading: false,
    error: undefined,
  },
  getPresignedUrlStatus: {
    isLoading: false,
    error: undefined,
  },
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
      // Convenience computed properties for loading states
      isLoading: computed(
        () =>
          state.fetchFormsStatus().isLoading ||
          state.addFormStatus().isLoading ||
          state.approveFormStatus().isLoading ||
          state.rejectFormStatus().isLoading
      ),
    };
  }),
  withMethods((state) => {
    const userStore = inject(UserStore);
    const apiService = inject(ApiService);
    const notificationService = inject(NotificationService);
    const router = inject(Router);
    const translateService = inject(TranslateService);
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

        updateState({
          fetchFormsStatus: { isLoading: true, error: undefined },
        });

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
              updateState({
                fetchFormsStatus: {
                  isLoading: false,
                  error: 'Failed to fetch forms',
                },
              });
              return;
            }
            updateState({
              forms: response.forms,
              fetchFormsStatus: { isLoading: false, error: undefined },
            });
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
              updateState({
                fetchFormsStatus: {
                  isLoading: false,
                  error: 'Failed to fetch forms',
                },
              });
              return;
            }
            updateState({
              forms: response.forms,
              fetchFormsStatus: { isLoading: false, error: undefined },
            });
          }
        } catch (error) {
          console.error('Error fetching forms:', error);
          notificationService.handleApiError(
            error,
            'errors.forms.fetch-failed'
          );
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to fetch forms';
          updateState({
            fetchFormsStatus: { isLoading: false, error: errorMessage },
          });
        }
      },

      async addForm(
        formType: FormType,
        items: InventoryItem[],
        userId: string,
        description: string
      ): Promise<boolean> {
        const organizationId = userStore.selectedOrganizationId();
        if (!organizationId) {
          throw new Error('No organization selected');
        }

        updateState({
          addFormStatus: { isLoading: true, error: undefined },
        });

        try {
          const response = await firstValueFrom(
            apiService.endpoints.createForm.execute(
              {
                formType,
                userId,
                items,
                description,
              },
              {
                [ORGANIZATION_ID_PATH_PARAM]: organizationId,
              }
            )
          );

          if (!response.status) {
            console.log('Error creating checkout form:', response);
            notificationService.showError(
              response.errorKey || 'errors.forms.submit-failed',
              response.errorMessage
            );
            updateState({
              addFormStatus: {
                isLoading: false,
                error:
                  response.errorMessage || 'Failed to submit check-out form',
              },
            });
            return false;
          }

          notificationService.showSuccess(
            'forms.check-out-submitted',
            'Check-out request submitted successfully'
          );
          updateState({
            addFormStatus: { isLoading: false, error: undefined },
            forms: [response.form, ...state.forms()],
          });

          // Ask user before navigating to forms page
          const shouldNavigate = confirm(
            translateService.instant('forms.view-submitted-form')
          );
          if (shouldNavigate) {
            const queryParams: FormQueryParams = {
              formType: formType,
              searchStatus: FormStatus.Pending,
              searchTerm: response.form.formID,
            };
            router.navigate(['/forms'], {
              queryParams,
            });
          }
          return true;
        } catch (error) {
          console.error('Error creating checkout form:', error);
          notificationService.handleApiError(
            error,
            'errors.forms.submit-failed'
          );
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to submit check-out form';
          updateState({
            addFormStatus: { isLoading: false, error: errorMessage },
          });
          throw error;
        }
      },

      async approveForm(formID: string, formUserId: string, signature: string) {
        updateState({
          approveFormStatus: { isLoading: true, error: undefined },
        });

        try {
          // Call the backend API to approve the form
          const response = await firstValueFrom(
            apiService.endpoints.approveForm.execute(
              {
                formID,
                userId: formUserId,
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
            updateState({
              approveFormStatus: {
                isLoading: false,
                error: response.errorMessage || 'Failed to approve form',
              },
            });
            return;
          }

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
          updateState({
            approveFormStatus: { isLoading: false, error: undefined },
          });
        } catch (error) {
          console.error('Error approving form:', error);
          notificationService.handleApiError(
            error,
            'errors.forms.approve-failed'
          );
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to approve form';
          updateState({
            approveFormStatus: { isLoading: false, error: errorMessage },
          });
          throw error;
        }
      },

      async rejectForm(formID: string, formUserId: string, reason: string) {
        updateState({
          rejectFormStatus: { isLoading: true, error: undefined },
        });

        try {
          // Call the backend API to reject the form
          const response = await firstValueFrom(
            apiService.endpoints.rejectForm.execute(
              { formID, reason, userId: formUserId },
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
            updateState({
              rejectFormStatus: {
                isLoading: false,
                error: response.errorMessage || 'Failed to reject form',
              },
            });
            return;
          }

          patchState(state, {
            forms: state
              .forms()
              .map((form) =>
                form.formID === formID ? response.updatedForm : form
              ),
          });

          console.log('Form rejected successfully:', formID, reason);
          notificationService.showSuccess(
            'forms.form-rejected',
            'Form rejected successfully'
          );
          updateState({
            rejectFormStatus: { isLoading: false, error: undefined },
          });
        } catch (error) {
          console.error('Error rejecting form:', error);
          notificationService.handleApiError(
            error,
            'errors.forms.reject-failed'
          );
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to reject form';
          updateState({
            rejectFormStatus: { isLoading: false, error: errorMessage },
          });
          throw error;
        }
      },

      // Clear error methods
      clearFetchFormsError() {
        updateState({
          fetchFormsStatus: {
            ...state.fetchFormsStatus(),
            error: undefined,
          },
        });
      },

      clearAddFormError() {
        updateState({
          addFormStatus: {
            ...state.addFormStatus(),
            error: undefined,
          },
        });
      },

      clearApproveFormError() {
        updateState({
          approveFormStatus: {
            ...state.approveFormStatus(),
            error: undefined,
          },
        });
      },

      clearRejectFormError() {
        updateState({
          rejectFormStatus: {
            ...state.rejectFormStatus(),
            error: undefined,
          },
        });
      },

      async getPresignedUrl(
        formId: string,
        formUserId: string,
        organizationId: string
      ): Promise<string> {
        const form = state.forms().find((form) => form.formID === formId);
        if (!form) {
          throw new Error('Form not found');
        }

        const presignedUrls = state.presignedUrls();
        if (presignedUrls[form.formID]?.ttl > Date.now()) {
          return presignedUrls[form.formID].url;
        }
        console.log('presignedUrls', presignedUrls);
        delete presignedUrls[form.formID];

        updateState({
          getPresignedUrlStatus: { isLoading: true, error: undefined },
          presignedUrls,
        });

        try {
          const result = await firstValueFrom(
            apiService.endpoints.getPresignedUrl.execute(undefined, {
              [ORGANIZATION_ID_PATH_PARAM]: organizationId,
              [USER_ID_PATH_PARAM]: formUserId,
              [FORM_ID_PATH_PARAM]: formId,
            })
          );

          if (result.status) {
            const expiresSeconds =
              getPresignedUrlTTL(result.presignedUrl) || 60; // 1 minute
            console.log('expires', expiresSeconds);
            updateState({
              getPresignedUrlStatus: { isLoading: false, error: undefined },
              forms: state
                .forms()
                .map((form) =>
                  form.formID === formId
                    ? { ...form, pdfUri: result.presignedUrl }
                    : form
                ),
              presignedUrls: {
                ...presignedUrls,
                [formId]: {
                  url: result.presignedUrl,
                  ttl: Date.now() + expiresSeconds * 1000,
                },
              },
            });
            return result.presignedUrl;
          } else {
            notificationService.handleApiError(
              result.errorKey,
              result.errorMessage
            );
            patchState(state, {
              getPresignedUrlStatus: {
                isLoading: false,
                error: result.errorMessage || '',
              },
            });
            throw new Error(result.errorMessage || '');
          }
        } catch (error: unknown) {
          console.error('Error getting presigned url', error);
          notificationService.handleApiError(
            error,
            'errors.presigned-url.get-failed'
          );
          patchState(state, {
            getPresignedUrlStatus: {
              isLoading: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to get presigned url',
            },
          });
          throw error;
        }
      },
    };
  })
);
