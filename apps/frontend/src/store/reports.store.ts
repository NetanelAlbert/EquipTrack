import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { ItemReport, ORGANIZATION_ID_PATH_PARAM } from '@equip-track/shared';
import { ApiService } from '../services/api.service';
import { UserStore } from './user.store';
import { firstValueFrom } from 'rxjs';

interface ReportsState {
  todayReport: ItemReport[] | null;
  lastReport: ItemReport[] | null;
  reportsByDate: Map<string, ItemReport[]>;
  loading: boolean;
  error: string | null;
}

const initialState: ReportsState = {
  todayReport: null,
  lastReport: null,
  reportsByDate: new Map(),
  loading: false,
  error: null,
};

export const ReportsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    hasTodayReport: computed(() => !!state.todayReport()),
    hasLastReport: computed(() => !!state.lastReport()),
  })),
  withMethods((store) => {
    const apiService = inject(ApiService);
    const userStore = inject(UserStore);

    const updateState = (newState: Partial<ReportsState>) => {
      patchState(store, (currentState) => ({
        ...currentState,
        ...newState,
      }));
    };

    return {
      async fetchReports() {
        updateState({ loading: true, error: null });

        try {
          const organizationId = userStore.selectedOrganizationId();
          if (!organizationId) {
            throw new Error('No organization selected');
          }

          // ✅ API call to fetch reports for last 30 days
          const reportsResponse = await firstValueFrom(
            apiService.endpoints.getReports.execute(undefined, {
              [ORGANIZATION_ID_PATH_PARAM]: organizationId,
            })
          );

          if (!reportsResponse.status) {
            throw new Error('Failed to fetch reports');
          }

          const reportsByDate = new Map(
            Object.entries(reportsResponse.reportsByDate || {})
          );

          // Extract today's and yesterday's reports for quick access
          const today = new Date().toISOString().split('T')[0];
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

          const todayReport = reportsByDate.get(today) || [];
          const lastReport = reportsByDate.get(yesterday) || [];

          updateState({
            reportsByDate,
            todayReport,
            lastReport,
            loading: false,
          });

          console.log('Reports fetched successfully from API:', {
            totalDates: reportsByDate.size,
            todayItems: todayReport.length,
            lastItems: lastReport.length,
          });
        } catch (error) {
          console.error('Failed to fetch reports:', error);
          updateState({
            error: 'Failed to fetch reports',
            loading: false,
          });
        }
      },

      async fetchReportsByDates(dates: string[]) {
        updateState({ loading: true, error: null });

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
            throw new Error('Failed to fetch reports by dates');
          }

          const reportsByDate = new Map(
            Object.entries(reportsResponse.reportsByDate || {})
          );

          updateState({
            reportsByDate,
            loading: false,
          });

          console.log('Reports fetched by dates successfully:', {
            requestedDates: dates.length,
            returnedDates: reportsByDate.size,
          });
        } catch (error) {
          console.error('Failed to fetch reports by dates:', error);
          updateState({
            error: 'Failed to fetch reports by dates',
            loading: false,
          });
        }
      },

      async updateItemReport(itemReport: ItemReport, date?: string) {
        const reportDate = date || new Date().toISOString().split('T')[0];

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
        const today = new Date().toISOString().split('T')[0];
        const todayReport =
          reportDate === today ? updatedReports : store.todayReport();

        updateState({
          reportsByDate: currentReportsByDate,
          todayReport,
          loading: true,
          error: null,
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
            throw new Error('Failed to publish item report');
          }

          updateState({
            loading: false,
          });

          console.log('Item report published successfully:', {
            date: reportDate,
            upi: itemReport.upi,
            publishedCount: publishResponse.publishedCount,
          });
        } catch (error) {
          console.error('Failed to publish item report:', error);

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
            error: 'Failed to update item report',
            loading: false,
          });

          throw error;
        }
      },

      async publishMultipleItems(items: ItemReport[], date?: string) {
        const reportDate = date || new Date().toISOString().split('T')[0];
        updateState({ loading: true, error: null });

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
            throw new Error('Failed to publish multiple item reports');
          }

          // Refresh reports after publishing
          await this.fetchReports();

          console.log('Multiple items published successfully:', {
            date: reportDate,
            itemCount: items.length,
            publishedCount: publishResponse.publishedCount,
          });
        } catch (error) {
          console.error('Failed to publish multiple items:', error);
          updateState({
            error: 'Failed to publish multiple item reports',
            loading: false,
          });
          throw error;
        }
      },
    };
  })
);
