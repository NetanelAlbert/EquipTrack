import { TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import type { InventoryItem } from '@equip-track/shared';
import { InventoryStore } from './inventory.store';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { UserStore } from './user.store';
import { OrganizationStore } from './organization.store';

describe('InventoryStore', () => {
  let store: InstanceType<typeof InventoryStore>;
  let executeSpy: jest.Mock;
  let addInventoryExecute: jest.Mock;
  let removeInventoryExecute: jest.Mock;
  let getInventoryExecute: jest.Mock;
  let selectedOrgSignal: WritableSignal<string>;
  let notificationService: {
    showSuccess: jest.Mock;
    showError: jest.Mock;
    handleApiError: jest.Mock;
  };

  beforeEach(() => {
    executeSpy = jest.fn().mockReturnValue(
      of({
        status: true,
        items: [],
        products: [],
      })
    );
    addInventoryExecute = jest.fn().mockReturnValue(of({ status: true }));
    removeInventoryExecute = jest.fn().mockReturnValue(of({ status: true }));
    getInventoryExecute = jest.fn().mockReturnValue(
      of({ status: true, totalItems: [] })
    );

    notificationService = {
      showError: jest.fn(),
      handleApiError: jest.fn(),
      showSuccess: jest.fn(),
    };

    selectedOrgSignal = signal('org-1');

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            endpoints: {
              getUserInventory: { execute: executeSpy },
              getInventory: { execute: getInventoryExecute },
              addInventory: { execute: addInventoryExecute },
              removeInventory: { execute: removeInventoryExecute },
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
            selectedOrganizationId: selectedOrgSignal,
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

  it('ensureUserInventoryLoaded forceRefresh bypasses cache', async () => {
    await store.ensureUserInventoryLoaded('user-refresh');
    await store.ensureUserInventoryLoaded('user-refresh', {
      forceRefresh: true,
    });

    expect(executeSpy).toHaveBeenCalledTimes(2);
  });

  it('ensureUserInventoryLoaded dedupes concurrent forceRefresh calls for same user', async () => {
    await store.ensureUserInventoryLoaded('user-refresh-dedupe');

    await Promise.all([
      store.ensureUserInventoryLoaded('user-refresh-dedupe', {
        forceRefresh: true,
      }),
      store.ensureUserInventoryLoaded('user-refresh-dedupe', {
        forceRefresh: true,
      }),
    ]);

    expect(executeSpy).toHaveBeenCalledTimes(2);
  });

  it('addInventory passes item count to success notification for i18n interpolation', async () => {
    const items: InventoryItem[] = [
      { productId: 'a', quantity: 1 },
      { productId: 'b', quantity: 2 },
    ];

    await store.addInventory(items);

    expect(notificationService.showSuccess).toHaveBeenCalledWith(
      'inventory.add.success',
      'Inventory items added successfully',
      { count: 2 }
    );
  });

  it('removeInventory passes item count to success notification for i18n interpolation', async () => {
    const items: InventoryItem[] = [{ productId: 'a', quantity: 1 }];

    await store.removeInventory(items);

    expect(notificationService.showSuccess).toHaveBeenCalledWith(
      'inventory.remove.success',
      'Inventory items removed successfully',
      { count: 1 }
    );
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

  it('clears totalInventory when organization changes and user inventory is fetched', async () => {
    const fakeItems: InventoryItem[] = [{ productId: 'p1', quantity: 5 }];
    getInventoryExecute.mockReturnValue(
      of({ status: true, totalItems: fakeItems })
    );

    await store.fetchTotalInventory();
    expect(store.totalInventory()).toEqual(fakeItems);

    selectedOrgSignal.set('org-2');
    await store.ensureUserInventoryLoaded('some-user');

    expect(store.totalInventory()).toEqual([]);
  });

  it('clears per-user inventory cache when organization changes', async () => {
    await store.ensureUserInventoryLoaded('user-x');
    expect(executeSpy).toHaveBeenCalledTimes(1);

    selectedOrgSignal.set('org-2');
    await store.ensureUserInventoryLoaded('user-x');

    expect(executeSpy).toHaveBeenCalledTimes(2);
  });
});
