import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { OrganizationSelectionService } from '../../services/organization-selection.service';
import { Organization } from '@equip-track/shared';

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
  private authService = inject(AuthService);
  private organizationService = inject(OrganizationSelectionService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);

  // State signals
  isLoading = signal(false);
  selectedOrgId = signal<string | null>(null);

  // Get user organizations from auth service
  userOrganizations = this.authService.userOrganizations;
  currentUser = this.authService.currentUser;

  // Get actual organization objects from user organization relationships
  availableOrganizations = computed(() => {
    // For now, we need to get organizations from the auth service's organizations list
    // This will be enhanced when we integrate with the full organizations store
    const userOrgIds = this.userOrganizations().map((uo) => uo.organizationId);

    // TODO: In future iterations, get actual organization data from AllOrganizationsStore
    // For now, create mock organizations based on user organization relationships
    return this.userOrganizations().map(
      (uo) =>
        ({
          id: uo.organizationId,
          name: `Organization ${uo.organizationId}`, // Placeholder - will be replaced with real data
          imageUrl: 'https://via.placeholder.com/150',
        } as Organization)
    );
  });

  hasOrganizations = computed(() => this.availableOrganizations().length > 0);

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
   * Handle organization selection
   */
  selectOrganization(organization: Organization): void {
    this.isLoading.set(true);
    this.selectedOrgId.set(organization.id);

    try {
      // Store selected organization
      this.organizationService.setSelectedOrganization(organization);

      // Show success message
      this.showSuccess(
        this.translateService.instant('organization.select.success', {
          name: organization.name,
        }) || `Selected ${organization.name}`
      );

      // Navigate to main app
      setTimeout(() => {
        this.router.navigate(['/my-items']);
      }, 1000);
    } catch (error) {
      console.error('Failed to select organization:', error);
      this.showError(
        this.translateService.instant('organization.select.error') ||
          'Failed to select organization'
      );
      this.selectedOrgId.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Generate invitation message and open email client
   */
  requestAccess(): void {
    const user = this.currentUser();
    if (!user) {
      this.showError('User information not available');
      return;
    }

    const appUrl = window.location.origin;
    const subject = this.translateService.instant(
      'organization.invitation.request-subject'
    );
    const body = this.translateService.instant(
      'organization.invitation.request-body',
      {
        email: user.email,
        appUrl: appUrl,
      }
    );

    // Create mailto link
    const mailtoLink = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    try {
      // Open email client
      window.location.href = mailtoLink;

      // Also copy to clipboard as fallback
      navigator.clipboard
        .writeText(`${subject}\n\n${body}`)
        .then(() => {
          this.showSuccess(
            this.translateService.instant('common.copied-to-clipboard') ||
              'Message copied to clipboard'
          );
        })
        .catch(() => {
          // Clipboard failed, but email client should still open
          console.warn('Could not copy to clipboard');
        });
    } catch (error) {
      console.error('Failed to open email client:', error);

      // Fallback: copy to clipboard only
      navigator.clipboard
        .writeText(`${subject}\n\n${body}`)
        .then(() => {
          this.showSuccess(
            this.translateService.instant('organization.invitation.copied') ||
              'Invitation message copied to clipboard'
          );
        })
        .catch(() => {
          this.showError('Failed to generate invitation message');
        });
    }
  }

  /**
   * Check if an organization is currently being selected
   */
  isSelectingOrganization(organizationId: string): boolean {
    return this.selectedOrgId() === organizationId && this.isLoading();
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    this.snackBar.open(
      message,
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
      message,
      this.translateService.instant('common.close') || 'Close',
      {
        duration: 5000,
        panelClass: ['error-snackbar'],
      }
    );
  }
}
