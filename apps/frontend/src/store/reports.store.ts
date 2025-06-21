import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { computed } from '@angular/core';
import { InventoryReport, ItemReport } from '@equip-track/shared';

interface ReportsState {
  todayReport: InventoryReport | null;
  lastReport: InventoryReport | null;
  loading: boolean;
  error: string | null;
}

const initialState: ReportsState = {
  todayReport: null,
  lastReport: null,
  loading: false,
  error: null,
};

const mockedReports: ReportsState = {
  todayReport: {
    organizationID: '1',
    date: '2025-06-09',
    items: [],
    lastUpdatedTimeStamp: Date.now(),
  },
  lastReport: {
    organizationID: '1',
    date: '2025-06-09',
    items: [
      {
        productId: '1',
        upi: '123',
        location: 'Location 1',
        repotedBy: 'User 1',
      },
      {
        productId: '2',
        upi: '456',
        location: 'Location 2',
        repotedBy: 'User 2',
      },
    ],
    lastUpdatedTimeStamp: Date.now(),
  },
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
  withMethods((store) => ({
    async fetcReports() {
      patchState(store, { loading: true, error: null });
      try {
        // TODO: Implement API call to fetch today's report
        patchState(store, {
          todayReport: mockedReports.todayReport,
          lastReport: mockedReports.lastReport,
          loading: false,
        });
        console.log('Reports fetched', store.todayReport());
      } catch (error) {
        console.error('Failed to fetch reports', error);
        patchState(store, {
          error: "Failed to fetch today's report",
          loading: false,
        });
      }
    },

    async updateItemReport(itemReport: ItemReport) {
      patchState(store, { loading: true, error: null });
      try {
        // TODO: Implement API call to update item report
        const todayReport = store.todayReport();
        if (todayReport) {
          const updatedItems = [...todayReport.items];
          const existingIndex = updatedItems.findIndex(
            (item) => item.upi === itemReport.upi
          );
          if (existingIndex >= 0) {
            updatedItems[existingIndex] = itemReport;
          } else {
            updatedItems.push(itemReport);
          }
          patchState(store, {
            todayReport: {
              ...todayReport,
              items: updatedItems,
              lastUpdatedTimeStamp: Date.now(),
            },
            loading: false,
          });
        }
      } catch (error) {
        patchState(store, {
          error: 'Failed to update item report',
          loading: false,
        });
      }
    },
  }))
);
