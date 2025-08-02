import {
  Component,
  ElementRef,
  inject,
  OnInit,
  signal, 
  ViewChild
} from '@angular/core';
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
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NotificationService } from '../../../services/notification.service';
import { OrganizationStore } from '../../../store/organization.store';
import { OrganizationService } from '../../../services/organization.service';
import {
  Department,
  User,
  UserDepartment,
  UserRole,
  UserState,
} from '@equip-track/shared';
import { UserStore } from '../../../store/user.store';

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
  private organizationService = inject(OrganizationService);
  private notificationService = inject(NotificationService);
  private translateService = inject(TranslateService);
  private fb = inject(FormBuilder);
  userStore = inject(UserStore);

  @ViewChild('inviteFormRef') inviteFormRef!: ElementRef<HTMLFormElement>;

  inviteForm: FormGroup = this.fb.group({
    email: new FormControl('', [Validators.required, Validators.email]),
    name: new FormControl('', [Validators.required]),
    departmentId: new FormControl('', [Validators.required]),
    role: new FormControl<UserRole>(UserRole.Customer, [Validators.required]),
    roleDescription: new FormControl('', [Validators.required]),
    subDepartmentId: new FormControl(''),
  });

  // State signals
  subDepartmentOptions = signal<Department[] | undefined>(undefined);

  // Get data from organization store
  users = this.organizationStore.users;
  isLoading = this.organizationStore.invitingUserStatus.isLoading;

  // Table configuration
  displayedColumns: string[] = ['name', 'email', 'role', 'state', 'actions'];

  // Enum references for template
  UserRole = UserRole;
  UserState = UserState;

  ngOnInit(): void {
    // Load users from API
    void this.organizationService.getUsers();
    // Check for email parameter from invite flow
    this.route.queryParams.subscribe((params) => {
      if (params['email']) {
        this.inviteForm.patchValue({ email: params['email'] });
        console.log('Pre-filled email from invite flow:', params['email']);
      }
    });

    this.inviteForm.controls['departmentId'].valueChanges.subscribe((value) => {
      const department = this.userStore
        .currentOrganization()
        ?.departments.find((d) => d.id === value);

      this.subDepartmentOptions.set(department?.subDepartments);
    });
  }

  /**
   * Invite a new user to the organization
   */
  async inviteUser(): Promise<void> {
    const rawEmail = this.inviteForm.value.email.trim();
    const role = this.inviteForm.value.role;

    if (!rawEmail) {
      this.showError('organization.users.invite.email-required');
      return;
    }

    // Normalize email: trim whitespace and convert to lowercase
    const email = rawEmail.toLowerCase();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showError('organization.users.invite.email-invalid');
      return;
    }

    if (!this.inviteForm.value.departmentId) {
      this.showError('organization.users.invite.department-required');
      return;
    }

    if (!this.inviteForm.value.roleDescription) {
      this.showError('organization.users.invite.role-description-required');
      return;
    }

    const name = this.inviteForm.value.name;

    const department: UserDepartment = {
      id: this.inviteForm.value.departmentId,
      roleDescription: this.inviteForm.value.roleDescription,
      subDepartmentId: this.inviteForm.value.subDepartmentId,
    };

    const success = await this.organizationService.inviteUser(
      email,
      name,
      role,
      department
    );

    if (success) {
      this.showSuccess('organization.users.invite.success', { email });
      // Reset form and clear all validation states
      this.resetInviteForm();
    } else {
      // Error handling is done in the store, but we can show additional UI feedback here if needed
      const errorMessage = this.organizationStore.invitingUserStatus()?.error;
      if (errorMessage) {
        this.showError('common.error', { error: errorMessage });
      } else {
        this.showError('organization.users.invite.error');
      }
    }
  }

  /**
   * Reset the invite form to clean state without validation errors
   */
  private resetInviteForm(): void {
    this.inviteFormRef.nativeElement.reset();
    this.subDepartmentOptions.set(undefined);
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
   * Show info message using translation key
   */
  private showInfo(
    messageKey: string,
    translationParams?: Record<string, string | number>
  ): void {
    this.notificationService.showInfo(messageKey, undefined, translationParams);
  }
}
