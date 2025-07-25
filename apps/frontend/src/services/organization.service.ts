import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  ORGANIZATION_ID_PATH_PARAM,
  Product,
  UserRole,
  Organization,
} from '@equip-track/shared';
import { OrganizationStore } from '../store/organization.store';

export interface SelectedOrganizationInfo {
  organizationId: string;
  organization: Organization;
  selectedAt: number; // timestamp for potential cache invalidation
}

@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
  private readonly SELECTED_ORG_KEY = 'equip-track-selected-org';
  private readonly apiService = inject(ApiService);
  private readonly translateService = inject(TranslateService);
  private readonly organizationStore = inject(OrganizationStore);

  constructor() {
    this.initializeSelectedOrganization();
  }

  /**
   * Initialize selected organization from localStorage on service creation
   */
  private initializeSelectedOrganization(): void {
    const stored = this.getSelectedOrganization();
    if (stored) {
      this.organizationStore.setOrganization(stored.organization);
    }
  }

  /**
   * Set selected organization and persist to localStorage
   */
  setSelectedOrganization(organization: Organization): void {
    try {
      const selectedInfo: SelectedOrganizationInfo = {
        organizationId: organization.id,
        organization,
        selectedAt: Date.now(),
      };

      localStorage.setItem(this.SELECTED_ORG_KEY, JSON.stringify(selectedInfo));

      // Update store
      this.organizationStore.setOrganization(organization);

      console.log('Organization selected and stored:', organization.name);
    } catch (error) {
      console.error('Failed to store selected organization:', error);
    }
  }

  /**
   * Get selected organization from localStorage
   */
  getSelectedOrganization(): SelectedOrganizationInfo | null {
    try {
      const stored = localStorage.getItem(this.SELECTED_ORG_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to retrieve selected organization:', error);
      return null;
    }
  }

  /**
   * Clear selected organization from localStorage and store
   */
  clearSelectedOrganization(): void {
    try {
      localStorage.removeItem(this.SELECTED_ORG_KEY);

      // Clear organization in store
      this.organizationStore.setOrganization({
        id: '',
        name: '',
        imageUrl: null,
      });

      console.log('Selected organization cleared');
    } catch (error) {
      console.error('Failed to clear selected organization:', error);
    }
  }

  /**
   * Check if an organization is currently selected
   */
  hasSelectedOrganization(): boolean {
    return !!this.organizationStore.organizationId();
  }

  /**
   * Update organization info (e.g., when organization data changes)
   */
  updateSelectedOrganizationInfo(organization: Organization): void {
    const currentSelected = this.getSelectedOrganization();
    if (currentSelected && currentSelected.organizationId === organization.id) {
      this.setSelectedOrganization(organization);
    }
  }


  async getUsers(): Promise<void> {
    this.organizationStore.setGetUsersLoading(true);

    try {
      const orgId = this.organizationStore.organizationId();
      const getUsersResponse = await firstValueFrom(
        this.apiService.endpoints.getUsers.execute(undefined, {
          [ORGANIZATION_ID_PATH_PARAM]: orgId,
        })
      );
      if (getUsersResponse.status) {
        this.organizationStore.setUsers(getUsersResponse.users);
        this.organizationStore.setGetUsersSuccess();
      } else {
        const error =
          getUsersResponse.errorMessage ||
          this.translateService.instant('organization.users.get.error');
        this.organizationStore.setGetUsersError(error);
      }
    } catch (error: unknown) {
      console.error('Error getting users', error);
      const errorMessage = this.translateService.instant(
        'organization.users.get.error'
      );
      this.organizationStore.setGetUsersError(errorMessage);
    }
  }

  async editProducts(products: Product[]): Promise<void> {
    this.organizationStore.setUpdatingProducts(true);

    try {
      // todo - call api to update products
      await new Promise((resolve, reject) => setTimeout(reject, 1000));
      this.organizationStore.setProducts(products);
      this.organizationStore.setUpdatingProductsSuccess();
    } catch (error: unknown) {
      console.error('Error updating products', error);
      // TODO: get error message translation key from api response
      this.organizationStore.setUpdatingProductsError(
        'Error updating products'
      );
    }
  }

  async inviteUser(email: string, role: UserRole): Promise<boolean> {
    this.organizationStore.setInvitingUserLoading(true);

    try {
      await firstValueFrom(
        this.apiService.endpoints.inviteUser.execute(
          {
            email,
            role,
            organizationId: this.organizationStore.organizationId(),
          },
          {
            [ORGANIZATION_ID_PATH_PARAM]:
              this.organizationStore.organizationId(),
          }
        )
      );

      this.organizationStore.setInvitingUserSuccess();
      return true;
    } catch (error: unknown) {
      console.error('Error inviting user', error);
      const errorMessage = this.translateService.instant(
        'organization.users.invite.error'
      );
      this.organizationStore.setInvitingUserError(errorMessage);
      return false;
    }
  }
}
