import { effect, Injectable, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UserStore } from '../store/user.store';
import { AuthStore } from '../store';
import { OrganizationService } from '../services/organization.service';

@Injectable({ providedIn: 'root' })
export class AppInitService {
  private authService = inject(AuthService);
  private userStore = inject(UserStore);
  private authStore = inject(AuthStore);
  private organizationService = inject(OrganizationService);

  constructor() {
    this.listenToOrganizationSelection();
  }

  async initialize(): Promise<void> {
    try {
      await this.authService.initializeAuth();
      await this.userStore.loadStartData();
      // load org selection after start data is loaded to not reset it,
      // due to missing organization in the user store
      this.userStore.loadPersistedOrganizationSelection();
    } catch (error) {
      console.error('Failed to initialize application:', error);
    }
  }

  private async listenToOrganizationSelection(): Promise<void> {
    effect(async () => {
      const organizationId = this.userStore.selectedOrganizationId();
      if (organizationId && this.authStore.isAuthenticated()) {
        setTimeout(async () => {
          this.organizationService.fetchProducts();
          this.organizationService.getUsers();
        });
      }
    });
  }
}
