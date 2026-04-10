import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { FormCardComponent } from './form-card.component';
import { FormsStore } from '../../../store/forms.store';
import { NotificationService } from '../../../services/notification.service';
import {
  FormStatus,
  FormType,
  InventoryForm,
} from '@equip-track/shared';
import { provideRouter } from '@angular/router';

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
  let mockFormsStore: { approveForm: jest.Mock; rejectForm: jest.Mock };
  let mockNotification: { handleApiError: jest.Mock; showSuccess: jest.Mock };

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
    };

    mockNotification = {
      handleApiError: jest.fn(),
      showSuccess: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        FormCardComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatDialog, useValue: mockDialog },
        { provide: FormsStore, useValue: mockFormsStore },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FormCardComponent);
    component = fixture.componentInstance;
    component.form = makeMockForm();
    fixture.detectChanges();
  });

  afterEach(() => {
    dialogClosedSubject.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onApprove', () => {
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
});
