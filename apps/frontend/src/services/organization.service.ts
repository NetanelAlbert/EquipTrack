import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  ORGANIZATION_ID_PATH_PARAM,
  Product,
  UserRole,
  Organization,
} from '@equip-track/shared';
import { OrganizationStore } from '../store/organization.store';
import { UserStore } from '../store/user.store';

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
  private readonly notificationService = inject(NotificationService);
  private readonly translateService = inject(TranslateService);
  private readonly organizationStore = inject(OrganizationStore);
  private readonly userStore = inject(UserStore);

  async getUsers(): Promise<void> {
    this.organizationStore.setGetUsersLoading(true);

    try {
      const orgId = this.userStore.selectedOrganizationId();
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
        this.notificationService.showError('errors.users.fetch-failed', error);
        this.organizationStore.setGetUsersError(error);
      }
    } catch (error: unknown) {
      console.error('Error getting users', error);
      this.notificationService.handleApiError(
        error,
        'errors.users.fetch-failed'
      );
      const errorMessage = this.translateService.instant(
        'organization.users.get.error'
      );
      this.organizationStore.setGetUsersError(errorMessage);
    }
  }

  async fetchProducts(): Promise<void> {
    const organizationId = this.userStore.selectedOrganizationId();
    if (!organizationId) {
      throw new Error('No organization selected');
    }

    try {
      this.organizationStore.setGetProductsLoading();
      const result = await firstValueFrom(
        this.apiService.endpoints.getProducts.execute(undefined, {
          [ORGANIZATION_ID_PATH_PARAM]: organizationId,
        })
      );
      if (result.status) {
        this.organizationStore.setProducts(result.products);
        this.organizationStore.setGetProductsSuccess();
      } else {
        const errorMessage =
          result.errorMessage ||
          this.translateService.instant('organization.products.get.error');
        console.error(
          'Error response from fetching products:',
          result.errorMessage
        );
        this.notificationService.showError(
          'errors.products.fetch-failed',
          errorMessage
        );
        this.organizationStore.setGetProductsError(errorMessage);
      }
    } catch (error: unknown) {
      console.error('Error fetching products', error);
      this.notificationService.handleApiError(
        error,
        'errors.products.fetch-failed'
      );
      const errorMessage = this.translateService.instant(
        'organization.products.get.error'
      );
      this.organizationStore.setGetProductsError(errorMessage);
    }
  }

  async saveProduct(product: Product): Promise<boolean> {
    try {
      const organizationId = this.userStore.selectedOrganizationId();
      if (!organizationId) {
        throw new Error('No organization selected');
      }

      const result = await firstValueFrom(
        this.apiService.endpoints.setProduct.execute(
          { product },
          { [ORGANIZATION_ID_PATH_PARAM]: organizationId }
        )
      );

      if (result.status) {
        // Update the product in the store
        const currentProducts = this.organizationStore.products();
        const existingIndex = currentProducts.findIndex(
          (p) => p.id === product.id
        );

        if (existingIndex >= 0) {
          // Update existing product
          const updatedProducts = [...currentProducts];
          updatedProducts[existingIndex] = product;
          this.organizationStore.setProducts(updatedProducts);
        } else {
          // Add new product
          this.organizationStore.setProducts([...currentProducts, product]);
        }

        this.notificationService.showSuccess(
          'organization.products.save-success',
          'Product saved successfully'
        );
        return true;
      } else {
        const errorMessage =
          result.errorMessage ||
          this.translateService.instant('organization.products.save.error');
        console.error('Error saving product:', errorMessage);
        this.notificationService.showError(
          'errors.products.save-failed',
          errorMessage
        );
        return false;
      }
    } catch (error: unknown) {
      console.error('Error saving product:', error);
      this.notificationService.handleApiError(
        error,
        'errors.products.save-failed'
      );
      return false;
    }
  }

  async deleteProduct(productId: string): Promise<boolean> {
    try {
      const organizationId = this.userStore.selectedOrganizationId();
      if (!organizationId) {
        throw new Error('No organization selected');
      }

      const result = await firstValueFrom(
        this.apiService.endpoints.deleteProduct.execute(
          { productId },
          { [ORGANIZATION_ID_PATH_PARAM]: organizationId }
        )
      );

      if (result.status) {
        // Remove the product from the store
        const currentProducts = this.organizationStore.products();
        const updatedProducts = currentProducts.filter(
          (p) => p.id !== productId
        );
        this.organizationStore.setProducts(updatedProducts);
        this.notificationService.showSuccess(
          'organization.products.delete-success',
          'Product deleted successfully'
        );
        return true;
      } else {
        const errorMessage =
          result.errorMessage ||
          this.translateService.instant('organization.products.delete.error');
        console.error('Error deleting product:', errorMessage);
        this.notificationService.showError(
          'errors.products.delete-failed',
          errorMessage
        );
        return false;
      }
    } catch (error: unknown) {
      console.error('Error deleting product:', error);
      this.notificationService.handleApiError(
        error,
        'errors.products.delete-failed'
      );
      return false;
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
            organizationId: this.userStore.selectedOrganizationId(),
          },
          {
            [ORGANIZATION_ID_PATH_PARAM]:
              this.userStore.selectedOrganizationId(),
          }
        )
      );

      this.organizationStore.setInvitingUserSuccess();
      this.notificationService.showSuccess(
        'organization.users.invite-success',
        'User invitation sent successfully'
      );
      return true;
    } catch (error: unknown) {
      console.error('Error inviting user', error);
      this.notificationService.handleApiError(
        error,
        'errors.users.invite-failed'
      );
      const errorMessage = this.translateService.instant(
        'organization.users.invite.error'
      );
      this.organizationStore.setInvitingUserError(errorMessage);
      return false;
    }
  }
}
