import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrganizationStore } from '../../../store/organization.store';
import { User, UserRole, UserState } from '@equip-track/shared';

@Component({
  selector: 'app-edit-users',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
  templateUrl: './edit-users.component.html',
  styleUrl: './edit-users.component.scss',
})
export class EditUsersComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private organizationStore = inject(OrganizationStore);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);

  // State signals
  isLoading = signal(false);
  inviteEmail = signal('');
  selectedRole = signal<UserRole>(UserRole.Customer);

  // Get users from organization store
  users = this.organizationStore.users;

  // Table configuration
  displayedColumns: string[] = ['name', 'email', 'role', 'state', 'actions'];

  // Enum references for template
  UserRole = UserRole;
  UserState = UserState;

  ngOnInit(): void {
    // Check for email parameter from invite flow
    this.route.queryParams.subscribe((params) => {
      if (params['email']) {
        this.inviteEmail.set(params['email']);
        console.log('Pre-filled email from invite flow:', params['email']);
      }
    });

    // TODO: Load users from API
    console.log('EditUsersComponent initialized');
  }

  /**
   * Invite a new user to the organization
   */
  inviteUser(): void {
    const email = this.inviteEmail().trim();
    const role = this.selectedRole();

    if (!email) {
      this.showError(
        this.translateService.instant(
          'organization.users.invite.email-required'
        )
      );
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showError(
        this.translateService.instant('organization.users.invite.email-invalid')
      );
      return;
    }

    this.isLoading.set(true);

    // TODO: Call inviteUser API endpoint
    console.log(`Inviting user: ${email} with role: ${role}`);

    // Simulate API call
    setTimeout(() => {
      this.showSuccess(
        this.translateService.instant('organization.users.invite.success', {
          email,
        })
      );
      this.inviteEmail.set('');
      this.isLoading.set(false);

      // TODO: Refresh user list
    }, 1000);
  }

  /**
   * Edit existing user (admin only)
   */
  editUser(user: User): void {
    // TODO: Implement user editing functionality
    console.log('Editing user:', user);
    this.showInfo(
      this.translateService.instant('organization.users.table.edit-coming-soon')
    );
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(role: UserRole): string {
    switch (role) {
      case UserRole.Admin:
        return this.translateService.instant('organization.users.roles.admin');
      case UserRole.WarehouseManager:
        return this.translateService.instant(
          'organization.users.roles.warehouse-manager'
        );
      case UserRole.Customer:
        return this.translateService.instant(
          'organization.users.roles.customer'
        );
      default:
        return role;
    }
  }

  /**
   * Get state display name
   */
  getStateDisplayName(state: UserState): string {
    switch (state) {
      case UserState.Active:
        return this.translateService.instant(
          'organization.users.states.active'
        );
      case UserState.Invited:
        return this.translateService.instant(
          'organization.users.states.invited'
        );
      case UserState.Disabled:
        return this.translateService.instant(
          'organization.users.states.disabled'
        );
      default:
        return state;
    }
  }

  /**
   * Get state CSS class for styling
   */
  getStateClass(state: UserState): string {
    switch (state) {
      case UserState.Active:
        return 'state-active';
      case UserState.Invited:
        return 'state-invited';
      case UserState.Disabled:
        return 'state-disabled';
      default:
        return '';
    }
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

  /**
   * Show info message
   */
  private showInfo(message: string): void {
    this.snackBar.open(
      message,
      this.translateService.instant('common.close') || 'Close',
      {
        duration: 4000,
        panelClass: ['info-snackbar'],
      }
    );
  }
}
