import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let snackBarSpy: { open: jest.Mock };
  let translateSpy: { instant: jest.Mock };

  beforeEach(() => {
    snackBarSpy = { open: jest.fn() };
    translateSpy = {
      instant: jest.fn((key: string) => {
        const translations: Record<string, string> = {
          'errors.inventory.duplicate-upi':
            'Cannot add inventory: one or more UPI codes already exist.',
          'common.close': 'Close',
        };
        return translations[key] ?? key;
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: MatSnackBar, useValue: snackBarSpy },
        { provide: TranslateService, useValue: translateSpy },
      ],
    });

    service = TestBed.inject(NotificationService);
  });

  describe('handleApiError', () => {
    it('should extract errorKey and errorMessage from HttpErrorResponse body', () => {
      const httpError = {
        status: 400,
        message: 'Http failure response: 400 Bad Request',
        error: {
          status: false,
          error: 'Duplicate UPI',
          errorMessage:
            'UPI already exists for product prod-1: UPI-001',
          errorKey: 'errors.inventory.duplicate-upi',
        },
      };

      service.handleApiError(httpError, 'errors.inventory.add-failed');

      expect(translateSpy.instant).toHaveBeenCalledWith(
        'errors.inventory.duplicate-upi',
        undefined
      );
      expect(snackBarSpy.open).toHaveBeenCalled();
      const [message] = snackBarSpy.open.mock.calls[0];
      expect(message).toBe(
        'Cannot add inventory: one or more UPI codes already exist.'
      );
    });

    it('should fall back to fallbackMessageKey when no error body is present', () => {
      const simpleError = new Error('Network failure');

      service.handleApiError(simpleError, 'errors.inventory.add-failed');

      expect(snackBarSpy.open).toHaveBeenCalled();
      const [message] = snackBarSpy.open.mock.calls[0];
      expect(message).toBe('Network failure');
    });

    it('should handle a plain status:false error object', () => {
      const apiError = {
        status: false,
        errorMessage: 'Some backend error',
        errorKey: 'errors.inventory.duplicate-upi',
      };

      service.handleApiError(apiError, 'errors.inventory.add-failed');

      expect(translateSpy.instant).toHaveBeenCalledWith(
        'errors.inventory.duplicate-upi',
        undefined
      );
    });
  });
});
