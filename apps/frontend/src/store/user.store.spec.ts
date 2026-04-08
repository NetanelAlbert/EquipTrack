import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { UserStore } from './user.store';
import { ApiService } from '../services/api.service';
import { AuthStore } from './auth.store';

describe('UserStore', () => {
  let store: InstanceType<typeof UserStore>;
  let startExecuteSpy: jest.Mock;

  beforeEach(() => {
    startExecuteSpy = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            endpoints: {
              start: { execute: startExecuteSpy },
            },
          },
        },
        {
          provide: AuthStore,
          useValue: {
            setToken: jest.fn(),
            token: signal(null),
          },
        },
      ],
    });

    store = TestBed.inject(UserStore);
  });

  describe('loadStartData error handling', () => {
    it('should store Error.message when an Error is thrown', async () => {
      startExecuteSpy.mockReturnValue(
        throwError(() => new Error('Network failure'))
      );

      await store.loadStartData();

      expect(store.startDataStatus()?.isLoading).toBe(false);
      expect(store.startDataStatus()?.error).toBe('Network failure');
    });

    it('should store the string directly when a string error is thrown', async () => {
      startExecuteSpy.mockReturnValue(
        throwError(() => 'Something went wrong')
      );

      await store.loadStartData();

      expect(store.startDataStatus()?.isLoading).toBe(false);
      expect(store.startDataStatus()?.error).toBe('Something went wrong');
    });

    it('should store fallback message when a non-Error object is thrown', async () => {
      startExecuteSpy.mockReturnValue(
        throwError(() => ({ status: 500, message: 'Server error' }))
      );

      await store.loadStartData();

      expect(store.startDataStatus()?.isLoading).toBe(false);
      expect(store.startDataStatus()?.error).toBe(
        'An unknown error occurred'
      );
    });

    it('should store fallback message when null is thrown', async () => {
      startExecuteSpy.mockReturnValue(throwError(() => null));

      await store.loadStartData();

      expect(store.startDataStatus()?.isLoading).toBe(false);
      expect(store.startDataStatus()?.error).toBe(
        'An unknown error occurred'
      );
    });

    it('should set isLoading to true before the API call', async () => {
      let capturedLoadingState: boolean | undefined;
      startExecuteSpy.mockImplementation(() => {
        capturedLoadingState = store.startDataStatus()?.isLoading;
        return throwError(() => new Error('fail'));
      });

      await store.loadStartData();

      expect(capturedLoadingState).toBe(true);
    });

    it('should store error message from failed API response', async () => {
      startExecuteSpy.mockReturnValue(of({ status: false }));

      await store.loadStartData();

      expect(store.startDataStatus()?.isLoading).toBe(false);
      expect(store.startDataStatus()?.error).toBe('Failed to load start data');
    });

    it('should store user data on successful API response', async () => {
      const mockUser = { id: 'u1', name: 'Test User' };
      const mockOrgs = [{ organizationId: 'org1', role: 'admin' }];
      const mockFullOrgs = [{ id: 'org1', name: 'Org 1' }];

      startExecuteSpy.mockReturnValue(
        of({
          status: true,
          user: mockUser,
          userInOrganizations: mockOrgs,
          organizations: mockFullOrgs,
        })
      );

      await store.loadStartData();

      expect(store.startDataStatus()?.isLoading).toBe(false);
      expect(store.startDataStatus()?.error).toBeUndefined();
      expect(store.user()).toEqual(mockUser);
    });
  });
});
