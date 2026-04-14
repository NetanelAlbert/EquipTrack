import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationService } from './organization.service';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { OrganizationStore } from '../store/organization.store';
import { UserStore } from '../store/user.store';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let getUsersExecute: jest.Mock;
  let organizationStore: {
    setGetUsersLoading: jest.Mock;
    setUsers: jest.Mock;
    setGetUsersSuccess: jest.Mock;
    setGetUsersError: jest.Mock;
  };
  let translateService: { instant: jest.Mock };
  let selectedOrgSignal: ReturnType<typeof signal<string | undefined>>;

  beforeEach(() => {
    getUsersExecute = jest.fn().mockReturnValue(
      of({ status: true, users: [] })
    );

    organizationStore = {
      setGetUsersLoading: jest.fn(),
      setUsers: jest.fn(),
      setGetUsersSuccess: jest.fn(),
      setGetUsersError: jest.fn(),
    };

    translateService = {
      instant: jest.fn((key: string) => key),
    };

    selectedOrgSignal = signal<string | undefined>('org-1');

    TestBed.configureTestingModule({
      providers: [
        OrganizationService,
        {
          provide: ApiService,
          useValue: {
            endpoints: {
              getUsers: { execute: getUsersExecute },
              getProducts: { execute: jest.fn() },
              setProduct: { execute: jest.fn() },
              deleteProduct: { execute: jest.fn() },
              inviteUser: { execute: jest.fn() },
            },
          },
        },
        {
          provide: NotificationService,
          useValue: {
            showError: jest.fn(),
            showSuccess: jest.fn(),
            handleApiError: jest.fn(),
          },
        },
        {
          provide: TranslateService,
          useValue: translateService,
        },
        {
          provide: OrganizationStore,
          useValue: organizationStore,
        },
        {
          provide: UserStore,
          useValue: {
            selectedOrganizationId: selectedOrgSignal,
          },
        },
      ],
    });

    service = TestBed.inject(OrganizationService);
  });

  it('getUsers sets loading and fetches users on success', async () => {
    const users = [{ user: { id: 'u1', name: 'User 1' } }];
    getUsersExecute.mockReturnValue(of({ status: true, users }));

    await service.getUsers();

    expect(organizationStore.setGetUsersLoading).toHaveBeenCalledWith(true);
    expect(organizationStore.setUsers).toHaveBeenCalledWith(users);
    expect(organizationStore.setGetUsersSuccess).toHaveBeenCalled();
  });

  it('getUsers returns early with error when org ID is undefined', async () => {
    selectedOrgSignal.set(undefined as unknown as string);

    await service.getUsers();

    expect(organizationStore.setGetUsersLoading).toHaveBeenCalledWith(true);
    expect(organizationStore.setGetUsersError).toHaveBeenCalled();
    expect(getUsersExecute).not.toHaveBeenCalled();
  });

  it('getUsers returns early with error when org ID is empty string', async () => {
    selectedOrgSignal.set('');

    await service.getUsers();

    expect(organizationStore.setGetUsersLoading).toHaveBeenCalledWith(true);
    expect(organizationStore.setGetUsersError).toHaveBeenCalled();
    expect(getUsersExecute).not.toHaveBeenCalled();
  });

  it('getUsers handles API error response', async () => {
    getUsersExecute.mockReturnValue(
      of({ status: false, errorMessage: 'Server error' })
    );

    await service.getUsers();

    expect(organizationStore.setGetUsersError).toHaveBeenCalled();
  });
});
