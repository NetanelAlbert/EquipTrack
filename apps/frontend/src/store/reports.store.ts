import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import {
  formatDateToString,
  ItemReport,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { UserStore } from './user.store';
import { firstValueFrom } from 'rxjs';
import { ApiStatus } from './stores.models';

interface ReportsState {
  todayReport: ItemReport[] | null;
  lastReport: ItemReport[] | null;
  reportsByDate: Map<string, ItemReport[]>;
  
  // API status for operations using ApiStatus
  fetchReportsStatus: ApiStatus;
  updateItemReportStatus: ApiStatus;
  publishMultipleItemsStatus: ApiStatus;
}

const initialState: ReportsState = {
  todayReport: null,
  lastReport: null,
  reportsByDate: new Map(),
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
  withComputed((state) => ({
    hasTodayReport: computed(() => !!state.todayReport()),
    hasLastReport: computed(() => !!state.lastReport()),
    // Convenience computed properties for loading states
    isLoading: computed(() => 
      state.fetchReportsStatus().isLoading ||
      state.updateItemReportStatus().isLoading ||
      state.publishMultipleItemsStatus().isLoading
    ),
  })),
  withMethods((store) => {
    const apiService = inject(ApiService);
    const notificationService = inject(NotificationService);
    const userStore = inject(UserStore);

    const updateState = (newState: Partial<ReportsState>) => {
      patchState(store, (currentState) => ({
        ...currentState,
        ...newState,
      }));
    };

    return {
      async fetchReports(dates: string[]) {
        updateState({ 
          fetchReportsStatus: { isLoading: true, error: undefined } 
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
            updateState({
              fetchReportsStatus: {
                isLoading: false,
                error: 'Failed to fetch reports by dates',
              },
            });
            return;
          }

          const reportsByDate = new Map(
            Object.entries(reportsResponse.reportsByDate || {})
          );

          updateState({
            reportsByDate,
            fetchReportsStatus: { isLoading: false, error: undefined },
          });

          console.log('Reports fetched by dates successfully:', {
            requestedDates: dates.length,
            returnedDates: reportsByDate.size,
          });
        } catch (error) {
          console.error('Failed to fetch reports by dates:', error);
          notificationService.handleApiError(
            error,
            'errors.reports.fetch-failed'
          );
          updateState({
            fetchReportsStatus: {
              isLoading: false,
              error: 'Failed to fetch reports by dates',
            },
          });
        }
      },

      async updateItemReport(itemReport: ItemReport, date?: string) {
        const reportDate = date || formatDateToString(new Date());

        // Optimistically update UI
        const currentReportsByDate = new Map(store.reportsByDate());
        const currentDateReports = currentReportsByDate.get(reportDate) || [];

        const updatedReports = [...currentDateReports];
        const existingIndex = updatedReports.findIndex(
          (item) => item.upi === itemReport.upi
        );

        if (existingIndex >= 0) {
          updatedReports[existingIndex] = itemReport;
        } else {
          updatedReports.push(itemReport);
        }

        currentReportsByDate.set(reportDate, updatedReports);

        // Update today's report if it's today's date
        const today = formatDateToString(new Date());
        const todayReport =
          reportDate === today ? updatedReports : store.todayReport();

        updateState({
          reportsByDate: currentReportsByDate,
          todayReport,
          updateItemReportStatus: { isLoading: true, error: undefined },
        });

        try {
          const organizationId = userStore.selectedOrganizationId();
          if (!organizationId) {
            throw new Error('No organization selected');
          }

          // ✅ API call to publish/update item report
          const publishResponse = await firstValueFrom(
            apiService.endpoints.publishPartialReport.execute(
              {
                date: reportDate,
                items: [itemReport],
              },
              { [ORGANIZATION_ID_PATH_PARAM]: organizationId }
            )
          );

          if (!publishResponse.status) {
            notificationService.showError(
              'errors.reports.publish-failed',
              publishResponse.errorMessage
            );

            // Revert optimistic update on error
            const originalReportsByDate = new Map(store.reportsByDate());
            const originalDateReports =
              originalReportsByDate.get(reportDate) || [];
            const revertedReports = originalDateReports.filter(
              (item) => item.upi !== itemReport.upi
            );
            originalReportsByDate.set(reportDate, revertedReports);

            updateState({
              reportsByDate: originalReportsByDate,
              todayReport:
                reportDate === today ? revertedReports : store.todayReport(),
              updateItemReportStatus: {
                isLoading: false,
                error: 'Failed to update item report',
              },
            });
            return;
          }

          updateState({
            updateItemReportStatus: { isLoading: false, error: undefined },
          });

          console.log('Item report published successfully:', {
            date: reportDate,
            upi: itemReport.upi,
            publishedCount: publishResponse.publishedCount,
          });
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

          // Revert optimistic update on error
          const originalReportsByDate = new Map(store.reportsByDate());
          const originalDateReports =
            originalReportsByDate.get(reportDate) || [];
          const revertedReports = originalDateReports.filter(
            (item) => item.upi !== itemReport.upi
          );
          originalReportsByDate.set(reportDate, revertedReports);

          const errorMessage = error instanceof Error ? error.message : 'Failed to update item report';
          updateState({
            reportsByDate: originalReportsByDate,
            todayReport:
              reportDate === today ? revertedReports : store.todayReport(),
            updateItemReportStatus: {
              isLoading: false,
              error: errorMessage,
            },
          });

          throw error;
        }
      },

      async publishMultipleItems(items: ItemReport[], date?: string) {
        const reportDate = date || formatDateToString(new Date());
        updateState({ 
          publishMultipleItemsStatus: { isLoading: true, error: undefined } 
        });

        try {
          const organizationId = userStore.selectedOrganizationId();
          if (!organizationId) {
            throw new Error('No organization selected');
          }

          // ✅ API call to publish multiple item reports
          const publishResponse = await firstValueFrom(
            apiService.endpoints.publishPartialReport.execute(
              {
                date: reportDate,
                items: items,
              },
              { [ORGANIZATION_ID_PATH_PARAM]: organizationId }
            )
          );

          if (!publishResponse.status) {
            notificationService.showError(
              'errors.reports.publish-failed',
              publishResponse.errorMessage
            );
            updateState({
              publishMultipleItemsStatus: {
                isLoading: false,
                error: 'Failed to publish multiple item reports',
              },
            });
            return;
          }

          // Refresh reports after publishing
          await this.fetchReports([reportDate]);

          console.log('Multiple items published successfully:', {
            date: reportDate,
            itemCount: items.length,
            publishedCount: publishResponse.publishedCount,
          });
          notificationService.showSuccess(
            'reports.items-published',
            `Successfully published ${items.length} item reports`
          );
          
          updateState({
            publishMultipleItemsStatus: { isLoading: false, error: undefined },
          });
        } catch (error) {
          console.error('Failed to publish multiple items:', error);
          notificationService.handleApiError(
            error,
            'errors.reports.publish-failed'
          );
          const errorMessage = error instanceof Error ? error.message : 'Failed to publish multiple item reports';
          updateState({
            publishMultipleItemsStatus: {
              isLoading: false,
              error: errorMessage,
            },
          });
          throw error;
        }
      },

      // Clear error methods
      clearFetchReportsError() {
        updateState({ 
          fetchReportsStatus: { 
            ...store.fetchReportsStatus(), 
            error: undefined 
          } 
        });
      },

      clearUpdateItemReportError() {
        updateState({ 
          updateItemReportStatus: { 
            ...store.updateItemReportStatus(), 
            error: undefined 
          } 
        });
      },

      clearPublishMultipleItemsError() {
        updateState({ 
          publishMultipleItemsStatus: { 
            ...store.publishMultipleItemsStatus(), 
            error: undefined 
          } 
        });
      },
    };
  })
);
