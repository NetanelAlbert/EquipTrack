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
  // Use a different key to avoid conflicts with UserStore
  private readonly apiService = inject(ApiService);
  private readonly translateService = inject(TranslateService);
  private readonly organizationStore = inject(OrganizationStore);

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
