import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { FormCardComponent } from './form-card.component';
import { FormsStore } from '../../../store/forms.store';
import { NotificationService } from '../../../services/notification.service';
import {
  CheckInEvent,
  FormStatus,
  FormType,
  InventoryForm,
  InventoryItem,
} from '@equip-track/shared';

function makeMockForm(overrides: Partial<InventoryForm> = {}): InventoryForm {
  return {
    formID: 'form-1',
    userID: 'user-1',
    organizationID: 'org-1',
    status: FormStatus.Pending,
    type: FormType.CheckOut,
    items: [],
    createdAtTimestamp: Date.now(),
    lastUpdated: Date.now(),
    description: 'Test form',
    ...overrides,
  };
}

describe('FormCardComponent', () => {
  let component: FormCardComponent;
  let fixture: ComponentFixture<FormCardComponent>;
  let dialogClosedSubject: Subject<string | undefined>;
  let mockDialog: { open: jest.Mock };
  let mockFormsStore: { approveForm: jest.Mock; rejectForm: jest.Mock; getCheckInEventPresignedUrl: jest.Mock };
  let mockNotification: { handleApiError: jest.Mock; showSuccess: jest.Mock };
  let routerSpy: { navigate: jest.Mock };

  const mockItems: InventoryItem[] = [
    { productId: 'prod-1', quantity: 2 },
    { productId: 'prod-2', quantity: 1, upis: ['UPI-001'] },
  ];

  const mockCheckOutForm: InventoryForm = {
    formID: 'form-checkout-1',
    userID: 'user-123',
    organizationID: 'org-1',
    status: FormStatus.Pending,
    type: FormType.CheckOut,
    items: mockItems,
    createdAtTimestamp: Date.now(),
    lastUpdated: Date.now(),
    description: 'Test checkout form',
    createdByUserId: 'user-admin',
  };

  const mockCheckInForm: InventoryForm = {
    formID: 'form-checkin-1',
    userID: 'user-456',
    organizationID: 'org-1',
    status: FormStatus.Approved,
    type: FormType.CheckIn,
    items: mockItems,
    createdAtTimestamp: Date.now(),
    lastUpdated: Date.now(),
    description: 'Test checkin form',
    createdByUserId: 'user-admin',
  };

  beforeEach(async () => {
    dialogClosedSubject = new Subject<string | undefined>();
    const mockDialogRef = {
      afterClosed: () => dialogClosedSubject.asObservable(),
    } as unknown as MatDialogRef<unknown>;

    mockDialog = {
      open: jest.fn().mockReturnValue(mockDialogRef),
    };

    mockFormsStore = {
      approveForm: jest.fn().mockResolvedValue(undefined),
      rejectForm: jest.fn().mockResolvedValue(undefined),
      getCheckInEventPresignedUrl: jest.fn().mockResolvedValue('https://example.com/event.pdf'),
    };

    mockNotification = {
      handleApiError: jest.fn(),
      showSuccess: jest.fn(),
    };

    routerSpy = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        FormCardComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: mockDialog },
        { provide: FormsStore, useValue: mockFormsStore },
        { provide: NotificationService, useValue: mockNotification },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FormCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    dialogClosedSubject.complete();
  });

  it('should create', () => {
    component.form = mockCheckOutForm;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('onApprove', () => {
    beforeEach(() => {
      component.form = makeMockForm();
      fixture.detectChanges();
    });

    it('should call approveForm when dialog returns a signature', fakeAsync(() => {
      component.onApprove();

      dialogClosedSubject.next('test-signature');
      dialogClosedSubject.complete();
      tick();

      expect(mockFormsStore.approveForm).toHaveBeenCalledWith(
        'form-1',
        'user-1',
        'test-signature'
      );
    }));

    it('should not call approveForm when dialog is cancelled', fakeAsync(() => {
      component.onApprove();

      dialogClosedSubject.next(undefined);
      dialogClosedSubject.complete();
      tick();

      expect(mockFormsStore.approveForm).not.toHaveBeenCalled();
    }));

    it('should show error notification when approveForm fails', fakeAsync(() => {
      const error = new Error('Network error');
      mockFormsStore.approveForm.mockRejectedValue(error);

      component.onApprove();

      dialogClosedSubject.next('test-signature');
      dialogClosedSubject.complete();
      tick();

      expect(mockNotification.handleApiError).toHaveBeenCalledWith(
        error,
        'errors.forms.approve-failed'
      );
    }));

    it('should not receive dialog events after component destroy', fakeAsync(() => {
      component.onApprove();

      fixture.destroy();

      dialogClosedSubject.next('test-signature');
      tick();

      expect(mockFormsStore.approveForm).not.toHaveBeenCalled();
    }));
  });

  describe('onReject', () => {
    beforeEach(() => {
      component.form = makeMockForm();
      fixture.detectChanges();
    });

    it('should call rejectForm when dialog returns a reason', fakeAsync(() => {
      component.onReject();

      dialogClosedSubject.next('Bad condition');
      dialogClosedSubject.complete();
      tick();

      expect(mockFormsStore.rejectForm).toHaveBeenCalledWith(
        'form-1',
        'user-1',
        'Bad condition'
      );
    }));

    it('should not call rejectForm when dialog is cancelled', fakeAsync(() => {
      component.onReject();

      dialogClosedSubject.next(undefined);
      dialogClosedSubject.complete();
      tick();

      expect(mockFormsStore.rejectForm).not.toHaveBeenCalled();
    }));

    it('should show error notification when rejectForm fails', fakeAsync(() => {
      const error = new Error('Server error');
      mockFormsStore.rejectForm.mockRejectedValue(error);

      component.onReject();

      dialogClosedSubject.next('Bad condition');
      dialogClosedSubject.complete();
      tick();

      expect(mockNotification.handleApiError).toHaveBeenCalledWith(
        error,
        'errors.forms.reject-failed'
      );
    }));

    it('should not receive dialog events after component destroy', fakeAsync(() => {
      component.onReject();

      fixture.destroy();

      dialogClosedSubject.next('Bad condition');
      tick();

      expect(mockFormsStore.rejectForm).not.toHaveBeenCalled();
    }));
  });

  describe('onCloneForm', () => {
    it('should navigate with formType, userId, and items for checkout form', () => {
      component.form = mockCheckOutForm;
      fixture.detectChanges();

      component.onCloneForm();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/create-form'], {
        queryParams: {
          formType: FormType.CheckOut,
          userId: 'user-123',
          items: JSON.stringify(mockItems),
        },
      });
    });

    it('should navigate with formType, userId, and items for checkin form', () => {
      component.form = mockCheckInForm;
      fixture.detectChanges();

      component.onCloneForm();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/create-form'], {
        queryParams: {
          formType: FormType.CheckIn,
          userId: 'user-456',
          items: JSON.stringify(mockItems),
        },
      });
    });

    it('should preserve the original form userId in clone params', () => {
      component.form = mockCheckOutForm;
      fixture.detectChanges();

      component.onCloneForm();

      const navigateCall = routerSpy.navigate.mock.calls[0];
      const queryParams = navigateCall[1].queryParams;
      expect(queryParams.userId).toBe(mockCheckOutForm.userID);
    });
  });

  describe('onCheckIn', () => {
    it('should navigate with CheckIn formType, userId, and items', () => {
      component.form = mockCheckOutForm;
      fixture.detectChanges();

      component.onCheckIn();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/create-form'], {
        queryParams: {
          formType: FormType.CheckIn,
          userId: 'user-123',
          items: JSON.stringify(mockItems),
        },
      });
    });
  });

  describe('outstanding items and check-in events display', () => {
    const approvedFormWithEvents: InventoryForm = {
      formID: 'form-approved-1',
      userID: 'user-1',
      organizationID: 'org-1',
      status: FormStatus.Approved,
      type: FormType.CheckOut,
      items: [{ productId: 'bulk-1', quantity: 5 }],
      createdAtTimestamp: Date.now(),
      lastUpdated: Date.now(),
      description: 'Approved form',
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [{ productId: 'bulk-1', quantity: 2 }],
          createdAtTimestamp: Date.now(),
          createdByUserId: 'wm-1',
          pdfUri: 'https://s3.example.com/cie-1.pdf',
        } as CheckInEvent,
      ],
    };

    it('shows partially-returned badge for approved form with outstanding items', () => {
      component.form = approvedFormWithEvents;
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('[data-testid="badge-partially-returned"]');
      expect(badge).toBeTruthy();
    });

    it('shows fully-returned badge when all items returned', () => {
      component.form = {
        ...approvedFormWithEvents,
        checkInEvents: [
          {
            checkInEventId: 'cie-full',
            items: [{ productId: 'bulk-1', quantity: 5 }],
            createdAtTimestamp: Date.now(),
            createdByUserId: 'wm-1',
          },
        ],
      };
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('[data-testid="badge-fully-returned"]');
      expect(badge).toBeTruthy();
    });

    it('shows check-in event section when events exist', () => {
      component.form = approvedFormWithEvents;
      fixture.detectChanges();

      const eventsSection = fixture.nativeElement.querySelector(
        '[data-testid="check-in-events-form-approved-1"]'
      );
      expect(eventsSection).toBeTruthy();
    });

    it('shows outstanding items section when items are outstanding', () => {
      component.form = approvedFormWithEvents;
      fixture.detectChanges();

      const outstandingSection = fixture.nativeElement.querySelector(
        '[data-testid="outstanding-form-approved-1"]'
      );
      expect(outstandingSection).toBeTruthy();
    });

    it('outstandingItems getter returns remaining items after check-in events', () => {
      component.form = approvedFormWithEvents;
      fixture.detectChanges();

      expect(component.outstandingItems).toEqual([{ productId: 'bulk-1', quantity: 3 }]);
    });

    it('isFormFullyReturned returns false when items remain', () => {
      component.form = approvedFormWithEvents;
      expect(component.isFormFullyReturned).toBe(false);
    });
  });
});
