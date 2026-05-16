import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { FormsStore } from './forms.store';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { UserStore } from './user.store';
import {
  FormStatus,
  FormType,
  InventoryForm,
  UserRole,
  CheckInEvent,
} from '@equip-track/shared';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

describe('FormsStore', () => {
  let store: InstanceType<typeof FormsStore>;
  let getPresignedUrlExecute: jest.Mock;
  let fetchFormsExecute: jest.Mock;
  let createFormExecute: jest.Mock;
  let checkInFormExecute: jest.Mock;
  let notificationService: {
    showSuccess: jest.Mock;
    showError: jest.Mock;
    handleApiError: jest.Mock;
  };

  const mockForm: InventoryForm = {
    formID: 'form-1',
    userID: 'user-1',
    organizationID: 'org-1',
    status: FormStatus.Pending,
    type: FormType.CheckOut,
    items: [],
    createdAtTimestamp: Date.now(),
    lastUpdated: Date.now(),
    description: 'Test form',
  };

  beforeEach(() => {
    getPresignedUrlExecute = jest.fn();
    fetchFormsExecute = jest.fn().mockReturnValue(
      of({ status: true, forms: [mockForm] })
    );
    createFormExecute = jest.fn().mockReturnValue(
      of({ status: true, form: mockForm })
    );
    checkInFormExecute = jest.fn();

    notificationService = {
      showSuccess: jest.fn(),
      showError: jest.fn(),
      handleApiError: jest.fn(),
    };

    (globalThis as unknown as Record<string, unknown>).__EQUIP_TRACK_E2E__ =
      true;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            endpoints: {
              getAllForms: { execute: fetchFormsExecute },
              getUserForms: { execute: fetchFormsExecute },
              getPresignedUrl: { execute: getPresignedUrlExecute },
              createForm: { execute: createFormExecute },
              approveForm: { execute: jest.fn() },
              rejectForm: { execute: jest.fn() },
              checkInForm: { execute: checkInFormExecute },
              getCheckInEventPresignedUrl: { execute: jest.fn() },
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
            currentRole: signal(UserRole.Admin),
            user: signal({ id: 'user-1', name: 'Test User' }),
            selectedOrganizationId: signal('org-1'),
          },
        },
        {
          provide: Router,
          useValue: { navigate: jest.fn() },
        },
        {
          provide: TranslateService,
          useValue: { instant: jest.fn((key: string) => key) },
        },
      ],
    });

    store = TestBed.inject(FormsStore);
  });

  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>)[
      '__EQUIP_TRACK_E2E__'
    ];
  });

  describe('getPresignedUrl', () => {
    it('should not mutate the presignedUrls state object when removing expired entry', async () => {
      await store.fetchForms();

      TestBed.flushEffects();

      getPresignedUrlExecute.mockReturnValue(
        of({
          status: true,
          presignedUrl: 'https://new-url?X-Amz-Expires=300',
        })
      );

      expect(store.forms().length).toBe(1);

      const url = await store.getPresignedUrl('form-1', 'user-1', 'org-1');

      expect(url).toBe('https://new-url?X-Amz-Expires=300');
      expect(getPresignedUrlExecute).toHaveBeenCalled();
    });

    it('should return cached url when TTL has not expired', async () => {
      await store.fetchForms();
      TestBed.flushEffects();

      getPresignedUrlExecute.mockReturnValue(
        of({
          status: true,
          presignedUrl: 'https://fresh-url?X-Amz-Expires=300',
        })
      );

      const url1 = await store.getPresignedUrl('form-1', 'user-1', 'org-1');
      expect(url1).toBe('https://fresh-url?X-Amz-Expires=300');
      expect(getPresignedUrlExecute).toHaveBeenCalledTimes(1);

      const url2 = await store.getPresignedUrl('form-1', 'user-1', 'org-1');
      expect(url2).toBe('https://fresh-url?X-Amz-Expires=300');
      expect(getPresignedUrlExecute).toHaveBeenCalledTimes(1);
    });

    it('should throw when form is not found', async () => {
      await expect(
        store.getPresignedUrl('nonexistent', 'user-1', 'org-1')
      ).rejects.toThrow('Form not found');
    });
  });

  it('addForm shows check-out success message for check-out forms', async () => {
    await store.addForm(FormType.CheckOut, [], 'user-1', 'test');

    expect(notificationService.showSuccess).toHaveBeenCalledWith(
      'forms.check-out-submitted',
      'Check-out request submitted successfully'
    );
  });

  it('addForm shows error notification when API returns status false', async () => {
    createFormExecute.mockReturnValue(
      of({
        status: false,
        errorMessage: 'Something went wrong',
        errorKey: 'errors.forms.submit-failed',
      })
    );

    const result = await store.addForm(
      FormType.CheckOut,
      [],
      'user-1',
      'test'
    );

    expect(result).toBe(false);
    expect(notificationService.showError).toHaveBeenCalledWith(
      'errors.forms.submit-failed',
      'Something went wrong'
    );
  });

  describe('checkInForm', () => {
    const approvedForm: InventoryForm = {
      ...mockForm,
      status: FormStatus.Approved,
      items: [{ productId: 'bulk-1', quantity: 5 }],
    };
    const mockEvent: CheckInEvent = {
      checkInEventId: 'cie-1',
      items: [{ productId: 'bulk-1', quantity: 2 }],
      createdAtTimestamp: Date.now(),
      createdByUserId: 'wm-1',
    };
    const updatedFormWithEvent: InventoryForm = {
      ...approvedForm,
      checkInEvents: [mockEvent],
    };

    beforeEach(async () => {
      fetchFormsExecute.mockReturnValue(
        of({ status: true, forms: [approvedForm] })
      );
      await store.fetchForms();
    });

    it('updates the form in the store on success', async () => {
      checkInFormExecute.mockReturnValue(
        of({ status: true, updatedForm: updatedFormWithEvent, event: mockEvent })
      );

      const event = await store.checkInForm(
        'form-1',
        'user-1',
        [{ productId: 'bulk-1', quantity: 2 }],
        'data:image/png;base64,sig'
      );

      expect(event).toEqual(mockEvent);
      const storedForm = store.forms().find((f) => f.formID === 'form-1');
      expect(storedForm?.checkInEvents).toHaveLength(1);
      expect(notificationService.showSuccess).toHaveBeenCalledWith(
        'forms.check-in-recorded',
        expect.any(String)
      );
    });

    it('shows error notification when API returns status false', async () => {
      checkInFormExecute.mockReturnValue(
        of({
          status: false,
          errorMessage: 'Check-in failed',
          errorKey: 'errors.forms.check-in-failed',
        })
      );

      await expect(
        store.checkInForm('form-1', 'user-1', [], 'sig')
      ).rejects.toThrow();
      expect(notificationService.showError).toHaveBeenCalled();
    });
  });

  it('addForm throws when no organization is selected', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            endpoints: {
              createForm: { execute: createFormExecute },
              getAllForms: { execute: jest.fn() },
              getUserForms: { execute: jest.fn() },
              approveForm: { execute: jest.fn() },
              rejectForm: { execute: jest.fn() },
              getPresignedUrl: { execute: jest.fn() },
              checkInForm: { execute: jest.fn() },
              getCheckInEventPresignedUrl: { execute: jest.fn() },
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
            selectedOrganizationId: signal(''),
            currentRole: signal(UserRole.Admin),
            user: signal({ id: 'user-1', name: 'Test User' }),
          },
        },
        {
          provide: Router,
          useValue: { navigate: jest.fn() },
        },
        {
          provide: TranslateService,
          useValue: { instant: jest.fn((key: string) => key) },
        },
      ],
    });

    const noOrgStore = TestBed.inject(FormsStore);

    await expect(
      noOrgStore.addForm(FormType.CheckOut, [], 'user-1', 'test')
    ).rejects.toThrow('No organization selected');
  });
});
