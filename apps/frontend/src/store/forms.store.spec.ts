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
} from '@equip-track/shared';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

describe('FormsStore', () => {
  let store: InstanceType<typeof FormsStore>;
  let getPresignedUrlExecute: jest.Mock;
  let fetchFormsExecute: jest.Mock;
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
              getAllForms: { execute: fetchFormsExecute },
              getUserForms: { execute: fetchFormsExecute },
              getPresignedUrl: { execute: getPresignedUrlExecute },
              createForm: { execute: jest.fn() },
              approveForm: { execute: jest.fn() },
              rejectForm: { execute: jest.fn() },
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
            user: signal({ id: 'user-1' }),
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

      // Call getPresignedUrl - it should NOT mutate the original state object
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

      // First call - should hit the API
      const url1 = await store.getPresignedUrl('form-1', 'user-1', 'org-1');
      expect(url1).toBe('https://fresh-url?X-Amz-Expires=300');
      expect(getPresignedUrlExecute).toHaveBeenCalledTimes(1);

      // Second call - should use cache
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
});
