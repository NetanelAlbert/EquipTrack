import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserAndUserInOrganization } from '@equip-track/shared';
import { UserStore } from '../../../store/user.store';

@Component({
  selector: 'app-user-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="user-display">
      <span class="user-name">{{ user().user.name }}</span>
      @if (departmentInfo(); as info) {
      <span class="department-info">
        @if (info.mainDepartment) {
        <span class="main-department">{{ info.mainDepartment }}</span>
        } @if (info.subDepartment) {
        <span class="sub-department">/ {{ info.subDepartment }}</span>
        } @if (info.roleDescription) {
        <span class="role-description">({{ info.roleDescription }})</span>
        }
      </span>
      }
    </div>
  `,
  styles: [
    `
      .user-display {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .user-name {
        font-weight: 500;
        color: var(--mat-option-label-text-color);
      }

      .department-info {
        font-size: 0.875em;
        color: var(--mat-option-supporting-text-color);
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
      }

      .main-department {
        color: var(--mat-option-supporting-text-color);
      }

      .sub-department {
        color: var(--mat-option-supporting-text-color);
      }

      .role-description {
        color: var(--mat-option-supporting-text-color);
        font-style: italic;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDisplayComponent {
  user = input.required<UserAndUserInOrganization>();

  private userStore = inject(UserStore);

  departmentInfo = computed(() => {
    const userData = this.user();
    const department = userData.userInOrganization.department;

    if (!department) {
      return null;
    }

    const mainDepartmentName = this.userStore.getDepartmentName(department.id);
    const subDepartmentName = department.subDepartmentId
      ? this.userStore.getDepartmentName(department.subDepartmentId)
      : undefined;

    return {
      mainDepartment: mainDepartmentName,
      subDepartment: subDepartmentName,
      roleDescription: department.roleDescription,
    };
  });
}
