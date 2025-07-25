import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../environments/environment';
import {
  User,
  UserRole,
  UserInOrganization,
  DecodedJwt,
  GoogleAuthResponse,
} from '@equip-track/shared';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiService = inject(ApiService);

  private readonly TOKEN_KEY = 'equip-track-jwt';
  private readonly API_URL = environment.apiUrl;

  // Authentication state signals
  public token = signal<string | null>(null);
  public isAuthenticated = computed(() => !!this.token());
  public currentUser = signal<User | null>(null);
  public currentRole = signal<UserRole | null>(null);
  public userOrganizations = signal<UserInOrganization[]>([]);

  // Computed signals for convenience
  public isAdmin = computed(() => this.currentRole() === UserRole.Admin);
  public isCustomer = computed(() => this.currentRole() === UserRole.Customer);
  public isWarehouseManager = computed(
    () => this.currentRole() === UserRole.WarehouseManager
  );
  public hasOrganizations = computed(() => this.userOrganizations().length > 0);

  constructor() {
    this.initializeAuth();
  }

  /**
   * Initialize authentication state from stored token
   */
  private initializeAuth(): void {
    const token = this.getStoredToken();
    if (token && this.isTokenValid(token)) {
      const decoded = this.decodeToken(token);
      if (decoded) {
        this.setAuthenticationState(decoded, token);
      }
    } else {
      this.clearAuthenticationState();
    }
  }

  /**
   * Authenticate with Google ID token
   */
  authenticateWithGoogle(idToken: string): Observable<GoogleAuthResponse> {
    return this.apiService.endpoints.googleAuth.execute(
      {
        idToken,
      },
      {},
      false
    )
      .pipe(
        map((response) => {
          if (response.status && response.jwt) {
            // Store JWT and update auth state
            this.storeToken(response.jwt);

            const decoded: DecodedJwt = {
              userId: response.user.id,
              orgIdToRole: response.userInOrganizations.reduce((acc, org) => {
                acc[org.organizationId] = org.role;
                return acc;
              }, {} as Record<string, UserRole>),
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 1 week
              user: response.user,
              userInOrganizations: response.userInOrganizations,
            };

            this.setAuthenticationState(decoded, response.jwt);
          }
          return response;
        }),
        catchError((error) => {
          console.error('Google authentication failed:', error);
          this.clearAuthenticationState();
          throw error;
        })
      );
  }

  /**
   * Sign out user
   */
  signOut(): void {
    this.removeStoredToken();
    this.clearAuthenticationState();

    // Disable auto-select for Google Sign-In
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }

    this.router.navigate(['/login']);
  }

  /**
   * Check if user is authenticated
   */
  isUserAuthenticated(): boolean {
    const token = this.getStoredToken();
    return token ? this.isTokenValid(token) : false;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser();
  }

  /**
   * Get current user role (from first organization)
   */
  getCurrentRole(): UserRole | null {
    return this.currentRole();
  }

  /**
   * Get user organizations
   */
  getUserOrganizations(): UserInOrganization[] {
    return this.userOrganizations();
  }

  /**
   * Check if user has required role
   */
  hasRole(allowedRoles: UserRole[]): boolean {
    const currentRole = this.getCurrentRole();
    return currentRole ? allowedRoles.includes(currentRole) : false;
  }

  /**
   * Get authorization header for API requests
   */
  getAuthorizationHeader(): { Authorization: string } | object {
    const token = this.getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Store JWT token in localStorage
   */
  private storeToken(token: string): void {
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
    } catch (error) {
      console.error('Failed to store authentication token:', error);
    }
  }

  /**
   * Get stored JWT token from localStorage
   */
  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Failed to retrieve authentication token:', error);
      return null;
    }
  }

  /**
   * Remove stored JWT token
   */
  private removeStoredToken(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Failed to remove authentication token:', error);
    }
  }

  /**
   * Decode JWT token payload
   */
  private decodeToken(token: string): DecodedJwt | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(atob(parts[1]));

      // For now, we'll need to store user info separately since JWT only has minimal data
      // This is a limitation that should be addressed in Unit 5 (Auth Store)
      const storedUser = this.getStoredUserInfo();

      return {
        ...payload,
        user: storedUser?.user || null,
        userInOrganizations: storedUser?.userInOrganizations || [],
      };
    } catch (error) {
      console.error('Failed to decode JWT token:', error);
      return null;
    }
  }

  /**
   * Check if JWT token is valid (not expired)
   */
  private isTokenValid(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded) {
        return false;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  /**
   * Set authentication state
   */
  private setAuthenticationState(decoded: DecodedJwt, token: string): void {
    this.token.set(token);
    this.apiService.setToken(token);

    if (decoded.user) {
      this.currentUser.set(decoded.user);
      this.userOrganizations.set(decoded.userInOrganizations);

      // Set primary role (from first organization)
      const primaryRole = decoded.userInOrganizations[0]?.role || null;
      this.currentRole.set(primaryRole);

      // Store user info for future token decoding
      this.storeUserInfo({
        user: decoded.user,
        userInOrganizations: decoded.userInOrganizations,
      });
    }
  }

  /**
   * Clear authentication state
   */
  private clearAuthenticationState(): void {
    this.token.set(null);
    this.currentUser.set(null);
    this.currentRole.set(null);
    this.userOrganizations.set([]);
    this.removeStoredUserInfo();
  }

  /**
   * Store user info for JWT decoding (temporary solution)
   */
  private storeUserInfo(userInfo: {
    user: User;
    userInOrganizations: UserInOrganization[];
  }): void {
    try {
      localStorage.setItem(`${this.TOKEN_KEY}-user`, JSON.stringify(userInfo));
    } catch (error) {
      console.error('Failed to store user info:', error);
    }
  }

  /**
   * Get stored user info
   */
  private getStoredUserInfo(): {
    user: User;
    userInOrganizations: UserInOrganization[];
  } | null {
    try {
      const stored = localStorage.getItem(`${this.TOKEN_KEY}-user`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to retrieve user info:', error);
      return null;
    }
  }

  /**
   * Remove stored user info
   */
  private removeStoredUserInfo(): void {
    try {
      localStorage.removeItem(`${this.TOKEN_KEY}-user`);
    } catch (error) {
      console.error('Failed to remove user info:', error);
    }
  }
}
