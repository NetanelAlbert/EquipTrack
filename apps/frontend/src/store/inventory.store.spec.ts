import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { InventoryStore } from './inventory.store';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { UserStore } from './user.store';
import { OrganizationStore } from './organization.store';

describe('InventoryStore', () => {
  let store: InstanceType<typeof InventoryStore>;
  let executeSpy: jest.Mock;

  beforeEach(() => {
    executeSpy = jest.fn().mockReturnValue(
      of({
        status: true,
        items: [],
        products: [],
      })
    );

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            endpoints: {
              getUserInventory: { execute: executeSpy },
              getInventory: { execute: jest.fn() },
              addInventory: { execute: jest.fn() },
              removeInventory: { execute: jest.fn() },
            },
          },
        },
        {
          provide: NotificationService,
          useValue: {
            showError: jest.fn(),
            handleApiError: jest.fn(),
            showSuccess: jest.fn(),
          },
        },
        {
          provide: UserStore,
          useValue: {
            selectedOrganizationId: signal('org-1'),
          },
        },
        {
          provide: OrganizationStore,
          useValue: {
            setProducts: jest.fn(),
          },
        },
      ],
    });

    store = TestBed.inject(InventoryStore);
  });

  it('getUserInventory returns the same Signal instance for the same user id', () => {
    const a = store.getUserInventory('user-a');
    const b = store.getUserInventory('user-a');
    expect(a).toBe(b);
  });

  it('ensureUserInventoryLoaded dedupes concurrent fetches for the same user', async () => {
    await Promise.all([
      store.ensureUserInventoryLoaded('user-dedupe'),
      store.ensureUserInventoryLoaded('user-dedupe'),
    ]);

    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('ensureUserInventoryLoaded does not call the API again after cache is populated', async () => {
    await store.ensureUserInventoryLoaded('user-once');
    await store.ensureUserInventoryLoaded('user-once');

    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('ensureUserInventoryLoaded retries after a failed fetch', async () => {
    executeSpy
      .mockReturnValueOnce(
        throwError(() => new Error('network'))
      )
      .mockReturnValue(
        of({ status: true, items: [], products: [] })
      );

    await expect(
      store.ensureUserInventoryLoaded('user-retry')
    ).rejects.toThrow();

    await store.ensureUserInventoryLoaded('user-retry');

    expect(executeSpy).toHaveBeenCalledTimes(2);
  });
});
