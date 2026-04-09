import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { FormType } from '@equip-track/shared';
import { FormsStore } from './forms.store';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { UserStore } from './user.store';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

describe('FormsStore', () => {
  let store: InstanceType<typeof FormsStore>;
  let createFormExecute: jest.Mock;
  let notificationService: {
    showSuccess: jest.Mock;
    showError: jest.Mock;
    handleApiError: jest.Mock;
  };

  const mockForm = {
    formID: 'form-1',
    userID: 'user-1',
    organizationID: 'org-1',
    items: [],
    type: FormType.CheckOut,
    status: 'pending',
    createdAtTimestamp: Date.now(),
    lastUpdated: Date.now(),
  };

  beforeEach(() => {
    createFormExecute = jest.fn().mockReturnValue(
      of({ status: true, form: mockForm })
    );

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
              createForm: { execute: createFormExecute },
              getAllForms: { execute: jest.fn() },
              getUserForms: { execute: jest.fn() },
              approveForm: { execute: jest.fn() },
              rejectForm: { execute: jest.fn() },
              getPresignedUrl: { execute: jest.fn() },
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
            currentRole: signal('admin'),
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

    store = TestBed.inject(FormsStore);
  });

  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>)[
      '__EQUIP_TRACK_E2E__'
    ];
  });

  it('addForm shows check-out success message for check-out forms', async () => {
    await store.addForm(FormType.CheckOut, [], 'user-1', 'test');

    expect(notificationService.showSuccess).toHaveBeenCalledWith(
      'forms.check-out-submitted',
      'Check-out request submitted successfully'
    );
  });

  it('addForm shows check-in success message for check-in forms', async () => {
    const checkInForm = { ...mockForm, type: FormType.CheckIn };
    createFormExecute.mockReturnValue(
      of({ status: true, form: checkInForm })
    );

    await store.addForm(FormType.CheckIn, [], 'user-1', 'test');

    expect(notificationService.showSuccess).toHaveBeenCalledWith(
      'forms.check-in-submitted',
      'Check-in request submitted successfully'
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
            currentRole: signal('admin'),
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
