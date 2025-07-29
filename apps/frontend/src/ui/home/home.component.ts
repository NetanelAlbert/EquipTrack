import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatGridListModule } from '@angular/material/grid-list';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NotificationService } from '../../services/notification.service';
import { UserStore } from '../../store';
import { OrganizationService } from '../../services/organization.service';
import { Organization } from '@equip-track/shared';
import { UserRole } from '@equip-track/shared';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

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
    MatProgressSpinner,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private userStore = inject(UserStore);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private translateService = inject(TranslateService);

  // State signals
  isRedirecting = signal(false);
  isLoading = computed<boolean>(
    () => this.userStore.startDataStatus()?.isLoading || this.isRedirecting()
  );
  selectedOrgId = signal<string | null>(null);

  // Get user organizations from user store
  currentUser = this.userStore.user;

  // Get actual organization objects from user organization relationships
  availableOrganizations = this.userStore.organizations;

  // Computed properties for template
  hasOrganizations = computed(() => this.availableOrganizations().length > 0);

  ngOnInit(): void {
    if (!this.hasOrganizations()) {
      this.userStore.loadStartData();
    }
    if (this.userStore.selectedOrganizationId()) {
      this.navigateToDefaultRoute(
        this.userStore.currentRole() ?? UserRole.Customer
      );
    }
  }

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
   * Get responsive row height based on screen size
   */
  getRowHeight(): string {
    if (typeof window === 'undefined') return '260px'; // SSR fallback

    const width = window.innerWidth;
    if (width < 600) return '240px'; // Mobile - slightly smaller
    if (width < 960) return '250px'; // Tablet
    return '260px'; // Desktop
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

    this.isRedirecting.set(true);
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

      this.showSuccess('organization.select.success');

      // Small delay to ensure stores are updated before navigation
      setTimeout(() => {
        this.isRedirecting.set(false);
        this.selectedOrgId.set(null);

        // Navigate to the appropriate route based on role
        this.navigateToDefaultRoute(currentRole);
      }, 100);
    } catch (error: unknown) {
      console.error('Error selecting organization:', error);
      this.isRedirecting.set(false);
      this.selectedOrgId.set(null);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to select organization';
      this.showError('common.error', { error: errorMessage });
    }
  }

  /**
   * Request access to organizations
   */
  requestAccess(): void {
    const user = this.currentUser();
    if (!user) {
      this.showError('common.user-info-unavailable');
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

      this.showSuccess('common.email-request-generated');
    } catch (error) {
      console.error('Failed to open email client:', error);
      this.showError('common.email-request-failed');
    }
  }

  /**
   * Show success message using translation key
   */
  private showSuccess(
    messageKey: string,
    translationParams?: Record<string, string | number>
  ): void {
    this.notificationService.showSuccess(
      messageKey,
      undefined,
      translationParams
    );
  }

  /**
   * Show error message using translation key
   */
  private showError(
    messageKey: string,
    translationParams?: Record<string, string | number>
  ): void {
    this.notificationService.showError(
      messageKey,
      undefined,
      translationParams
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
      this.showError('common.navigation-failed');
    }
  }
}
