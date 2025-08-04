import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { computed, inject, Signal } from '@angular/core';
import {
  formatDateToString,
  ItemReport,
  ORGANIZATION_ID_PATH_PARAM,
  ItemReportRequest,
} from '@equip-track/shared';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { UserStore } from './user.store';
import { firstValueFrom } from 'rxjs';
import { ApiStatus } from './stores.models';

interface ReportsState {
  reportsByDate: Record<string, ItemReport[]>;

  // API status for operations using ApiStatus
  fetchReportsStatus: ApiStatus;
  updateItemReportStatus: ApiStatus;
  publishMultipleItemsStatus: ApiStatus;
}

const initialState: ReportsState = {
  reportsByDate: {},
  fetchReportsStatus: {
    isLoading: false,
    error: undefined,
  },
  updateItemReportStatus: {
    isLoading: false,
    error: undefined,
  },
  publishMultipleItemsStatus: {
    isLoading: false,
    error: undefined,
  },
};

export const ReportsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => {
    return {
      isLoading: computed(
        () =>
          state.fetchReportsStatus().isLoading ||
          state.updateItemReportStatus().isLoading ||
          state.publishMultipleItemsStatus().isLoading
      ),
    };
  }),
  withMethods((store) => {
    const apiService = inject(ApiService);
    const notificationService = inject(NotificationService);
    const userStore = inject(UserStore);

    return {
      getReport(date: string): Signal<ItemReport[]> {
        console.log('getReport', date);
        if (!store.reportsByDate()[date]) {
          // Risky workaround. make sure to not update on empty response, to avoid infinite loop
          setTimeout(() => {
            this.fetchReport(date);
          });
        }
        return computed(() => store.reportsByDate()[date] || []);
      },

      async fetchReport(date: string) {
        this.fetchReports([date]);
      },

      async fetchReports(dates: string[]) {
        patchState(store, {
          fetchReportsStatus: { isLoading: true, error: undefined },
        });

        try {
          const organizationId = userStore.selectedOrganizationId();
          if (!organizationId) {
            throw new Error('No organization selected');
          }

          // ✅ API call to fetch reports for specific dates
          const reportsResponse = await firstValueFrom(
            apiService.endpoints.getReportsByDates.execute(
              { dates },
              { [ORGANIZATION_ID_PATH_PARAM]: organizationId }
            )
          );

          if (!reportsResponse.status) {
            notificationService.showError(
              'errors.reports.fetch-failed',
              reportsResponse.errorMessage
            );
            patchState(store, {
              fetchReportsStatus: {
                isLoading: false,
                error: 'Failed to fetch reports by dates',
              },
            });
            return;
          }

          const hasReports =
            Object.keys(reportsResponse.reportsByDate).length > 0;

          if (hasReports) {
            patchState(store, {
              reportsByDate: {
                ...store.reportsByDate(),
                ...reportsResponse.reportsByDate,
              },
            });
          }

          patchState(store, {
            fetchReportsStatus: { isLoading: false, error: undefined },
          });

          console.log('Reports fetched by dates successfully:', {
            requestedDates: dates.length,
            returnedDates: Object.keys(reportsResponse.reportsByDate).length,
          });
        } catch (error) {
          console.error('Failed to fetch reports by dates:', error);
          notificationService.handleApiError(
            error,
            'errors.reports.fetch-failed'
          );
          patchState(store, {
            fetchReportsStatus: {
              isLoading: false,
              error: 'Failed to fetch reports by dates',
            },
          });
        }
      },

      async updateItemReport(itemReport: ItemReportRequest) {
        this.updateItemsReport([itemReport]);
      },

      async updateItemsReport(items: ItemReportRequest[]) {
        patchState(store, {
          updateItemReportStatus: { isLoading: true, error: undefined },
        });

        try {
          const organizationId = userStore.selectedOrganizationId();
          if (!organizationId) {
            throw new Error('No organization selected');
          }

          const publishResponse = await firstValueFrom(
            apiService.endpoints.publishPartialReport.execute(
              {
                items,
              },
              { [ORGANIZATION_ID_PATH_PARAM]: organizationId }
            )
          );

          if (!publishResponse.status) {
            notificationService.showError(
              'errors.reports.publish-failed',
              publishResponse.errorMessage
            );
            return;
          }

          patchState(store, {
            updateItemReportStatus: { isLoading: false, error: undefined },
          });

          this.addTodayReport(publishResponse.items);

          console.log('Item reports published successfully:', items);
          notificationService.showSuccess(
            'reports.item-published',
            'Item report updated successfully'
          );
        } catch (error) {
          console.error('Failed to publish item report:', error);
          notificationService.handleApiError(
            error,
            'errors.reports.publish-failed'
          );

          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to update item report';
          patchState(store, {
            updateItemReportStatus: {
              isLoading: false,
              error: errorMessage,
            },
          });

          throw error;
        }
      },

      addTodayReport(items: ItemReport[]) {
        // assuming all items are for the same date
        const date = items[0].reportDate || '';
        console.log('addTodayReport', date, items);
        patchState(store, {
          reportsByDate: {
            ...store.reportsByDate(),
            [date]: addReports(store.reportsByDate()[date] || [], items),
          },
        });
      },

      // Clear error methods
      clearFetchReportsError() {
        patchState(store, {
          fetchReportsStatus: {
            ...store.fetchReportsStatus(),
            error: undefined,
          },
        });
      },

      clearUpdateItemReportError() {
        patchState(store, {
          updateItemReportStatus: {
            ...store.updateItemReportStatus(),
            error: undefined,
          },
        });
      },

      clearPublishMultipleItemsError() {
        patchState(store, {
          publishMultipleItemsStatus: {
            ...store.publishMultipleItemsStatus(),
            error: undefined,
          },
        });
      },
    };
  })
);

function addReports(reports: ItemReport[], reportsToAdd: ItemReport[]) {
  const newReports = [...reports];
  reportsToAdd.forEach((report) => {
    const index = newReports.findIndex(
      (r) => r.productId === report.productId && r.upi === report.upi
    );
    if (index !== -1) {
      newReports[index] = report;
    } else {
      newReports.push(report);
    }
  });
  return newReports;
}
