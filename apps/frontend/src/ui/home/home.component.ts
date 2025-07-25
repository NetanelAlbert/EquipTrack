import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserStore } from '../../store';
import { OrganizationService } from '../../services/organization.service';
import { Organization } from '@equip-track/shared';
import { UserRole } from '@equip-track/shared';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatGridListModule,
    TranslateModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private userStore = inject(UserStore);
  private organizationService = inject(OrganizationService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);

  // State signals
  isLoading = signal(false);
  selectedOrgId = signal<string | null>(null);

  // Get user organizations from user store
  userOrganizations = this.userStore.userInOrganizations;
  currentUser = this.userStore.user;

  // Computed properties for template
  hasOrganizations = computed(() => this.userOrganizations().length > 0);

  // Get actual organization objects from user organization relationships
  availableOrganizations = computed(() => {
    // For now, we need to get organizations from the user store's organizations list
    // This will be enhanced when we integrate with the full organizations store
    const userOrgIds = this.userOrganizations().map((uo) => uo.organizationId);

    // TODO: In future iterations, get actual organization data from AllOrganizationsStore
    // For now, create mock organizations based on user organization relationships
    return this.userOrganizations().map((uo) => ({
      id: uo.organizationId,
      name: `Organization ${uo.organizationId}`, // Mock name
      imageUrl: null,
    }));
  });

  /**
   * Get responsive grid columns based on screen size
   */
  getGridCols(): number {
    if (typeof window === 'undefined') return 3; // SSR fallback

    const width = window.innerWidth;
    if (width < 600) return 1; // Mobile
    if (width < 960) return 2; // Tablet
    return 3; // Desktop
  }

  /**
   * Check if a specific organization is being selected
   */
  isSelectingOrganization(organizationId: string): boolean {
    return this.isLoading() && this.selectedOrgId() === organizationId;
  }

  /**
   * Handle organization selection (for template compatibility)
   */
  selectOrganization(organization: Organization): void {
    this.onSelectOrganization(organization.id);
  }

  /**
   * Handle organization selection with improved error handling and navigation
   */
  onSelectOrganization(organizationId: string): void {
    if (this.isLoading()) {
      return; // Prevent multiple selections
    }

    this.isLoading.set(true);
    this.selectedOrgId.set(organizationId);

    try {
      // Validate organization access
      if (!this.userStore.hasAccessToOrganization(organizationId)) {
        throw new Error('You do not have access to this organization');
      }

      // Update user store with selected organization
      const success = this.userStore.selectOrganization(organizationId);

      if (!success) {
        throw new Error('Failed to select organization');
      }

      // Ensure the role is available after selection
      const currentRole = this.userStore.currentRole();
      if (!currentRole) {
        throw new Error(
          'Unable to determine user role in selected organization'
        );
      }

      this.showSuccess('Organization selected successfully');

      // Small delay to ensure stores are updated before navigation
      setTimeout(() => {
        this.isLoading.set(false);
        this.selectedOrgId.set(null);

        // Navigate to the appropriate route based on role
        this.navigateToDefaultRoute(currentRole);
      }, 100);
    } catch (error: unknown) {
      console.error('Error selecting organization:', error);
      this.isLoading.set(false);
      this.selectedOrgId.set(null);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to select organization';
      this.showError(errorMessage);
    }
  }

  /**
   * Request access to organizations
   */
  requestAccess(): void {
    const user = this.currentUser();
    if (!user) {
      this.showError('User information not available');
      return;
    }

    const appUrl = window.location.origin;
    const subject =
      this.translateService.instant(
        'organization.invitation.request-subject'
      ) || 'Access Request';
    const body =
      this.translateService.instant('organization.invitation.request-body', {
        email: user.email,
        appUrl: appUrl,
      }) || `Please grant access to ${user.email} for ${appUrl}`;

    // Create mailto link
    const mailtoLink = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    try {
      // Open email client
      window.location.href = mailtoLink;

      this.showSuccess('Email client opened with access request');
    } catch (error) {
      console.error('Failed to open email client:', error);
      this.showError('Failed to generate access request');
    }
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    this.snackBar.open(
      this.translateService.instant(message) || message,
      this.translateService.instant('common.close') || 'Close',
      {
        duration: 3000,
        panelClass: ['success-snackbar'],
      }
    );
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.snackBar.open(
      this.translateService.instant(message) || message,
      this.translateService.instant('common.close') || 'Close',
      {
        duration: 5000,
        panelClass: ['error-snackbar'],
      }
    );
  }

  /**
   * Navigate to appropriate route based on user role
   */
  private navigateToDefaultRoute(role: UserRole): void {
    try {
      let targetRoute = '/my-items'; // Default route for all roles

      // Role-specific default routes (optional customization)
      switch (role) {
        case UserRole.Admin:
          targetRoute = '/my-items'; // Admin can also start with my-items
          break;
        case UserRole.WarehouseManager:
          targetRoute = '/my-items'; // Warehouse managers can start with my-items
          break;
        case UserRole.Customer:
          targetRoute = '/my-items'; // Customers start with my-items
          break;
        default:
          targetRoute = '/my-items';
      }

      console.log(`Navigating to ${targetRoute} for role: ${role}`);
      this.router.navigate([targetRoute]);
    } catch (navigationError) {
      console.error('Navigation failed:', navigationError);
      this.showError('Navigation failed. Please try again.');
    }
  }
}
