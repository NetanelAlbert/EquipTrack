import { Injectable, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UserStore } from '../store/user.store';
import { AuthStore } from '../store';

@Injectable({ providedIn: 'root' })
export class AppInitService {
  private authService = inject(AuthService);
  private userStore = inject(UserStore);
  private authStore = inject(AuthStore);

  async initialize(): Promise<void> {
    try {
      await this.authService.initializeAuth();
      if (this.authStore.isAuthenticated()) {
        await this.userStore.loadStartData();
        this.userStore.loadPersistedOrganizationSelection();
      }
    } catch (error) {
      console.error('Failed to initialize application:', error);
    }
  }
}
