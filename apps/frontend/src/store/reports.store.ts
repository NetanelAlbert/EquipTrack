import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import {
  ItemReport,
  ORGANIZATION_ID_PATH_PARAM,
  ItemReportRequest,
  InventoryItem,
  itemReportCompositeKey,
} from '@equip-track/shared';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { UserStore } from './user.store';
import { firstValueFrom } from 'rxjs';
import { ApiStatus } from './stores.models';

interface ReportsState {
  reportsByDate: Record<string, ItemReport[]>;
  itemsToReport: Record<string, InventoryItem[]>;

  // API status for operations using ApiStatus
  fetchReportsStatus: ApiStatus;
  updateItemReportStatus: ApiStatus;
  publishMultipleItemsStatus: ApiStatus;
  fetchItemsToReportStatus: ApiStatus;
}

const initialState: ReportsState = {
  reportsByDate: {},
  itemsToReport: {},
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
  fetchItemsToReportStatus: {
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
          state.publishMultipleItemsStatus().isLoading ||
          state.fetchItemsToReportStatus().isLoading
      ),
    };
  }),
  withMethods((store) => {
    const apiService = inject(ApiService);
    const notificationService = inject(NotificationService);
    const userStore = inject(UserStore);

    return {
      /**
       * Fetches reports for dates that are not yet present in state.
       * Call from components/effects — do not nest `computed(() => store.getReport(d)())`
       * (a new inner computed each run breaks signal tracking, e.g. after HMR).
       */
      ensureReportsForDates(dates: string[]): void {
        const byDate = store.reportsByDate();
        const missing = dates.filter((d) => byDate[d] === undefined);
        if (missing.length === 0) {
          return;
        }
        void this.fetchReports(missing);
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
            patchState(store, {
              updateItemReportStatus: {
                isLoading: false,
                error: publishResponse.errorMessage ?? 'Failed to publish report',
              },
            });
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

      async fetchItemsToReport() {
        patchState(store, {
          fetchItemsToReportStatus: { isLoading: true, error: undefined },
        });
        try {
          const organizationId = userStore.selectedOrganizationId();
          if (!organizationId) {
            throw new Error('No organization selected');
          }

          const itemsToReportResponse = await firstValueFrom(
            apiService.endpoints.getItemsToReport.execute(undefined, { [ORGANIZATION_ID_PATH_PARAM]: organizationId })
          );

          if (!itemsToReportResponse.status) {
            notificationService.showError(
              itemsToReportResponse.errorKey ?? 'errors.reports.fetch-items-to-report-failed',
              itemsToReportResponse.errorMessage ?? 'Failed to fetch items to report'
            );
            patchState(store, {
              fetchItemsToReportStatus: {
                isLoading: false,
                error: itemsToReportResponse.errorMessage ?? 'Failed to fetch items to report',
              },
            });
            return;
          }

          patchState(store, {
            itemsToReport: itemsToReportResponse.itemsByHolder,
            fetchItemsToReportStatus: { isLoading: false, error: undefined },
          });
        } catch (error) {
          console.error('Failed to fetch items to report:', error);
          notificationService.handleApiError(
            error,
            'errors.reports.fetch-items-to-report-failed'
          );
          patchState(store, {
            fetchItemsToReportStatus: { isLoading: false, error: 'Failed to fetch items to report' },
          });
        }
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
      (r) =>
        itemReportCompositeKey(r.productId, r.upi) ===
        itemReportCompositeKey(report.productId, report.upi)
    );
    if (index !== -1) {
      newReports[index] = report;
    } else {
      newReports.push(report);
    }
  });
  return newReports;
}
