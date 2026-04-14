import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ReportsStore } from './reports.store';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { UserStore } from './user.store';

describe('ReportsStore', () => {
  let store: InstanceType<typeof ReportsStore>;
  let publishPartialReportExecute: jest.Mock;
  let getReportsByDatesExecute: jest.Mock;
  let getItemsToReportExecute: jest.Mock;
  let notificationService: {
    showSuccess: jest.Mock;
    showError: jest.Mock;
    handleApiError: jest.Mock;
  };

  beforeEach(() => {
    publishPartialReportExecute = jest.fn();
    getReportsByDatesExecute = jest.fn();
    getItemsToReportExecute = jest.fn();

    notificationService = {
      showSuccess: jest.fn(),
      showError: jest.fn(),
      handleApiError: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            endpoints: {
              publishPartialReport: {
                execute: publishPartialReportExecute,
              },
              getReportsByDates: { execute: getReportsByDatesExecute },
              getItemsToReport: { execute: getItemsToReportExecute },
            },
          },
        },
        {
          provide: NotificationService,
          useValue: notificationService,
        },
        {
          provide: UserStore,
          useValue: {
            selectedOrganizationId: signal('org-1'),
          },
        },
      ],
    });

    store = TestBed.inject(ReportsStore);
  });

  describe('updateItemsReport', () => {
    it('should reset isLoading to false on API failure response', async () => {
      publishPartialReportExecute.mockReturnValue(
        of({
          status: false,
          errorMessage: 'Publish failed',
        })
      );

      await store.updateItemsReport([
        { productId: 'p1', location: 'loc1' },
      ] as never);

      expect(store.updateItemReportStatus().isLoading).toBe(false);
      expect(store.updateItemReportStatus().error).toBe('Publish failed');
    });

    it('should set error message on API failure response', async () => {
      publishPartialReportExecute.mockReturnValue(
        of({
          status: false,
          errorMessage: 'Server validation error',
        })
      );

      await store.updateItemsReport([
        { productId: 'p1', location: 'loc1' },
      ] as never);

      expect(store.updateItemReportStatus().error).toBe(
        'Server validation error'
      );
      expect(notificationService.showError).toHaveBeenCalledWith(
        'errors.reports.publish-failed',
        'Server validation error'
      );
    });

    it('should use fallback error message when errorMessage is undefined', async () => {
      publishPartialReportExecute.mockReturnValue(
        of({ status: false })
      );

      await store.updateItemsReport([
        { productId: 'p1', location: 'loc1' },
      ] as never);

      expect(store.updateItemReportStatus().error).toBe(
        'Failed to publish report'
      );
      expect(store.updateItemReportStatus().isLoading).toBe(false);
    });

    it('should not remain globally loading after a failed publish', async () => {
      publishPartialReportExecute.mockReturnValue(
        of({ status: false, errorMessage: 'fail' })
      );

      await store.updateItemsReport([
        { productId: 'p1', location: 'loc1' },
      ] as never);

      expect(store.isLoading()).toBe(false);
    });

    it('should clear loading and error on success', async () => {
      publishPartialReportExecute.mockReturnValue(
        of({
          status: true,
          items: [{ productId: 'p1', reportDate: '2026-04-08' }],
        })
      );

      await store.updateItemsReport([
        { productId: 'p1', location: 'loc1' },
      ] as never);

      expect(store.updateItemReportStatus().isLoading).toBe(false);
      expect(store.updateItemReportStatus().error).toBeUndefined();
      expect(notificationService.showSuccess).toHaveBeenCalled();
    });

    it('should reset isLoading on exception', async () => {
      publishPartialReportExecute.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      await expect(
        store.updateItemsReport([
          { productId: 'p1', location: 'loc1' },
        ] as never)
      ).rejects.toThrow('Network error');

      expect(store.updateItemReportStatus().isLoading).toBe(false);
      expect(store.updateItemReportStatus().error).toBe('Network error');
    });
  });

  describe('fetchItemsToReport', () => {
    it('should not overwrite itemsToReport on API failure', async () => {
      getItemsToReportExecute.mockReturnValueOnce(
        of({
          status: true,
          itemsByHolder: { 'user-1': [{ productId: 'p1' }] },
        })
      );
      await store.fetchItemsToReport();
      expect(store.itemsToReport()).toEqual({
        'user-1': [{ productId: 'p1' }],
      });

      getItemsToReportExecute.mockReturnValueOnce(
        of({
          status: false,
          errorMessage: 'Fetch failed',
          itemsByHolder: undefined,
        })
      );
      await store.fetchItemsToReport();

      expect(store.itemsToReport()).toEqual({
        'user-1': [{ productId: 'p1' }],
      });
    });

    it('should set error status on API failure', async () => {
      getItemsToReportExecute.mockReturnValue(
        of({
          status: false,
          errorMessage: 'Something went wrong',
        })
      );

      await store.fetchItemsToReport();

      expect(store.fetchItemsToReportStatus().isLoading).toBe(false);
      expect(store.fetchItemsToReportStatus().error).toBe(
        'Something went wrong'
      );
    });

    it('should use fallback error when errorMessage is undefined', async () => {
      getItemsToReportExecute.mockReturnValue(
        of({ status: false })
      );

      await store.fetchItemsToReport();

      expect(store.fetchItemsToReportStatus().error).toBe(
        'Failed to fetch items to report'
      );
      expect(store.fetchItemsToReportStatus().isLoading).toBe(false);
    });

    it('should show error notification on failure', async () => {
      getItemsToReportExecute.mockReturnValue(
        of({
          status: false,
          errorKey: 'errors.reports.fetch-items-to-report-failed',
          errorMessage: 'Custom error',
        })
      );

      await store.fetchItemsToReport();

      expect(notificationService.showError).toHaveBeenCalledWith(
        'errors.reports.fetch-items-to-report-failed',
        'Custom error'
      );
    });

    it('should update itemsToReport on success', async () => {
      getItemsToReportExecute.mockReturnValue(
        of({
          status: true,
          itemsByHolder: { 'user-2': [{ productId: 'p2' }] },
        })
      );

      await store.fetchItemsToReport();

      expect(store.itemsToReport()).toEqual({
        'user-2': [{ productId: 'p2' }],
      });
      expect(store.fetchItemsToReportStatus().isLoading).toBe(false);
      expect(store.fetchItemsToReportStatus().error).toBeUndefined();
    });

    it('should handle exception by setting error status', async () => {
      getItemsToReportExecute.mockReturnValue(
        throwError(() => new Error('Network failure'))
      );

      await store.fetchItemsToReport();

      expect(store.fetchItemsToReportStatus().isLoading).toBe(false);
      expect(store.fetchItemsToReportStatus().error).toBe(
        'Failed to fetch items to report'
      );
      expect(notificationService.handleApiError).toHaveBeenCalled();
    });
  });

  describe('fetchReports', () => {
    it('should set error status on API failure', async () => {
      getReportsByDatesExecute.mockReturnValue(
        of({
          status: false,
          errorMessage: 'Reports fetch failed',
        })
      );

      await store.fetchReports(['2026-04-08']);

      expect(store.fetchReportsStatus().isLoading).toBe(false);
      expect(store.fetchReportsStatus().error).toBe(
        'Failed to fetch reports by dates'
      );
      expect(notificationService.showError).toHaveBeenCalled();
    });

    it('should clear error and loading on success', async () => {
      getReportsByDatesExecute.mockReturnValue(
        of({
          status: true,
          reportsByDate: { '2026-04-08': [] },
        })
      );

      await store.fetchReports(['2026-04-08']);

      expect(store.fetchReportsStatus().isLoading).toBe(false);
      expect(store.fetchReportsStatus().error).toBeUndefined();
    });
  });
});
