import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { GoogleAuthRequest, GoogleAuthResponse, RefreshTokenResponse } from '@equip-track/shared';
import { ApiService } from './api.service';
import { AuthStore } from '../store/auth.store';
import { UserStore } from '../store/user.store';
import { STORAGE_KEYS } from '../utils/consts';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private apiService = inject(ApiService);
  private authStore = inject(AuthStore);
  private userStore = inject(UserStore);

  // Initialize authentication with enhanced error handling
  async initializeAuth(): Promise<boolean> {
    this.authStore.setInitializationLoading(true);

    try {
      const storedToken = this.getStoredToken();
      if (storedToken && this.validateAndCacheToken(storedToken)) {
        this.authStore.setToken(storedToken);
        this.authStore.setInitializationSuccess();
        return true;
      } else {
        this.clearInvalidTokenData();
        this.authStore.setInitializationSuccess();
        return false;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Initialization failed';
      this.authStore.setInitializationError(errorMessage);
      console.error('Auth initialization failed:', error);
      return false;
    }
  }

  // Enhanced Google authentication with comprehensive error handling
  authenticateWithGoogle(idToken: string): Observable<GoogleAuthResponse> {
    this.authStore.setAuthLoading();

    const request: GoogleAuthRequest = { idToken };

    return this.apiService.endpoints.googleAuth
      .execute(request, {}, false)
      .pipe(
        map((response) => {
          if (response.status && response.jwt) {
            // Store JWT token
            this.storeToken(response.jwt);
            this.authStore.setToken(response.jwt);
            this.validateAndCacheToken(response.jwt);

            this.authStore.setAuthSuccess();
          } else {
            this.authStore.setAuthError('Invalid authentication response');
          }
          return response;
        }),
        catchError((error) => {
          console.error('Google authentication failed:', error);

          let errorMessage = 'Authentication failed';
          if (error.status === 0) {
            errorMessage = 'Network error. Please check your connection.';
          } else if (error.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (error.status === 401 || error.status === 403) {
            errorMessage =
              'Authentication failed. Please verify your account access.';
          } else if (error.message) {
            errorMessage = error.message;
          }

          this.authStore.setAuthError(errorMessage);
          this.clearAuthenticationState();
          throw error;
        })
      );
  }

  // Enhanced sign out with cleanup
  signOut(): void {
    // Clear token and user data
    this.clearAuthenticationState();

    // Disable auto-select for Google Sign-In
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }

    // Navigate to login
    this.router.navigate(['/login']);
  }

  // Check if user is authenticated
  isUserAuthenticated(): boolean {
    const token = this.authStore.token();
    if (!token) return false;

    return this.validateAndCacheToken(token);
  }

  // Refresh JWT token with current permissions
  refreshToken(): Observable<RefreshTokenResponse> {
    console.log('[AUTH] Starting token refresh');
    this.authStore.setAuthLoading();

    return this.apiService.endpoints.refreshToken
      .execute(undefined, {}, true) // true = requires auth
      .pipe(
        map((response) => {
          if (response.status && response.jwt) {
            console.log('[AUTH] Token refresh successful');
            
            // Store new JWT token
            this.storeToken(response.jwt);
            this.authStore.setToken(response.jwt);
            this.validateAndCacheToken(response.jwt);

            this.authStore.setAuthSuccess();
          } else {
            this.authStore.setAuthError('Invalid token refresh response');
          }
          return response;
        }),
        catchError((error) => {
          console.error('Token refresh failed:', error);

          let errorMessage = 'Token refresh failed';
          if (error.status === 401 || error.status === 403) {
            errorMessage = 'Session expired. Please sign in again.';
            // Auto sign out on auth failure
            this.signOut();
          } else if (error.status === 0) {
            errorMessage = 'Network error. Please check your connection.';
          } else if (error.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (error.message) {
            errorMessage = error.message;
          }

          this.authStore.setAuthError(errorMessage);
          throw error;
        })
      );
  }

  // Auto refresh token when permissions might be stale
  async autoRefreshIfNeeded(): Promise<boolean> {
    const token = this.authStore.token();
    if (!token) {
      return false;
    }

    try {
      // Check if token is close to expiration (within 1 hour)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const oneHour = 60 * 60;
      
      if (payload.exp - currentTime < oneHour) {
        console.log('[AUTH] Token expires soon, refreshing...');
        await this.refreshToken().toPromise();
        return true;
      }
    } catch (error) {
      console.error('Auto refresh check failed:', error);
      return false;
    }

    return false;
  }

  private validateAndCacheToken(token: string): boolean {
    const isValid = this.isTokenValid(token);
    this.authStore.updateTokenValidationCache(isValid);
    return isValid;
  }

  private clearInvalidTokenData(): void {
    this.clearStoredToken();
    this.authStore.setToken(null);
  }

  private clearAuthenticationState(): void {
    this.authStore.clearAuthState();
    this.userStore.clearUser();
    this.clearStoredToken();
  }

  // Token management helper functions

  private storeToken(token: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    } catch (error) {
      console.error('Failed to store authentication token:', error);
    }
  }

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      console.error('Failed to retrieve authentication token:', error);
      return null;
    }
  }

  private clearStoredToken(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      console.error('Failed to remove authentication token:', error);
    }
  }

  private isTokenValid(token: string): boolean {
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
}
