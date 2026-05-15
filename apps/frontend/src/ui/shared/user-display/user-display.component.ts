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
  templateUrl: './user-display.component.html',
  styleUrl: './user-display.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDisplayComponent {
  user = input.required<UserAndUserInOrganization>();

  private userStore = inject(UserStore);

  departmentInfo = computed(() => {
    const userData = this.user();
    const department = userData?.userInOrganization?.department;

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
