import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
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
});
