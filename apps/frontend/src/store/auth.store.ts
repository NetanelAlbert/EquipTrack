import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { computed } from '@angular/core';
import { ApiStatus } from './stores.models';

interface AuthStoreState {
  // Token management
  token: string | null;

  // Authentication status (moved from UserStore)
  authStatus: ApiStatus;
  initializationStatus: ApiStatus;

  // Performance optimization
  lastTokenValidation: number;
  tokenValidationCache: boolean | null;
}

const emptyState: AuthStoreState = {
  token: null,
  authStatus: {
    isLoading: false,
    error: undefined,
  },
  initializationStatus: {
    isLoading: false,
    error: undefined,
  },
  lastTokenValidation: 0,
  tokenValidationCache: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(emptyState),
  withComputed((store) => {
    // Token validation with caching
    const isAuthenticated = computed(() => {
      const token = store.token();
      if (!token) return false;

      // Use cached validation if recent (within 30 seconds)
      const now = Date.now();
      const lastValidation = store.lastTokenValidation();
      const cacheValid = now - lastValidation < 30000; // 30 seconds

      if (cacheValid && store.tokenValidationCache() !== null) {
        return store.tokenValidationCache()!;
      }

      // Perform validation and cache result
      const isValid = isTokenValid(token);
      return isValid;
    });

    // Authentication state summary
    const authenticationState = computed(() => ({
      isAuthenticated: isAuthenticated(),
      isLoading: store.authStatus().isLoading,
      error: store.authStatus().error,
      isInitializing: store.initializationStatus().isLoading,
      initializationError: store.initializationStatus().error,
    }));

    return {
      isAuthenticated,
      authenticationState,
    };
  }),
  withMethods((store) => {
    const updateState = (newState: Partial<AuthStoreState>) => {
      patchState(store, newState);
    };

    return {
      // Token management
      setToken(token: string | null) {
        updateState({ token });
      },

      // Token validation caching
      updateTokenValidationCache(isValid: boolean) {
        updateState({
          tokenValidationCache: isValid,
          lastTokenValidation: Date.now(),
        });
      },

      // Auth status management
      setAuthLoading() {
        updateState({
          authStatus: { isLoading: true, error: undefined },
        });
      },

      setAuthSuccess() {
        updateState({
          authStatus: { isLoading: false, error: undefined },
        });
      },

      setAuthError(error: string) {
        updateState({
          authStatus: { isLoading: false, error },
        });
      },

      // Initialization status management
      setInitializationLoading(isLoading: boolean) {
        updateState({
          initializationStatus: { isLoading, error: undefined },
        });
      },

      setInitializationSuccess() {
        updateState({
          initializationStatus: { isLoading: false, error: undefined },
        });
      },

      setInitializationError(error: string) {
        updateState({
          initializationStatus: { isLoading: false, error },
        });
      },

      // Clear authentication state
      clearAuthState() {
        updateState({
          token: null,
          tokenValidationCache: null,
          lastTokenValidation: 0,
          authStatus: { isLoading: false, error: undefined },
          initializationStatus: { isLoading: false, error: undefined },
        });
      },
    };
  })
);

// Helper function for token validation
function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp > currentTime;
  } catch (error) {
    return false;
  }
}
