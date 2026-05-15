import { Component, computed, model, input, inject } from '@angular/core';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormCardComponent } from '../form-card/form-card.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import {
  InventoryForm,
  FormStatus,
  UserAndUserInOrganization,
} from '@equip-track/shared';
import { OrganizationStore } from '../../../store/organization.store';
import { UserStore } from '../../../store/user.store';

type StatusFilterOptions = 'all' | 'pending' | 'approved' | 'rejected';
type SortOptions = 'newest' | 'oldest';

export interface DepartmentFilterOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-forms-tab-content',
  standalone: true,
  imports: [
    TranslateModule,
    FormCardComponent,
    EmptyStateComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    FormsModule,
  ],
  templateUrl: './forms-tab-content.component.html',
  styleUrl: './forms-tab-content.component.scss',
})
export class FormsTabContentComponent {
  private readonly organizationStore = inject(OrganizationStore);
  private readonly userStore = inject(UserStore);
  private readonly translateService = inject(TranslateService);

  forms = input.required<InventoryForm[]>();
  emptyStateMessage = input.required<string>();
  showUserFilters = input<boolean>(false);

  searchTerm = model<string>('');
  statusFilter = model<StatusFilterOptions>('pending');
  sortBy = model<SortOptions>('newest');
  filterDepartmentId = model<string>('all');
  filterUserId = model<string>('all');

  departmentFilterOptions = computed<DepartmentFilterOption[]>(() => {
    const org = this.userStore.currentOrganization();
    if (!org) return [];

    const options: DepartmentFilterOption[] = [];
    for (const dept of org.departments ?? []) {
      options.push({ id: dept.id, name: dept.name });
      for (const subDept of dept.subDepartments ?? []) {
        options.push({ id: subDept.id, name: subDept.name });
      }
    }
    return options;
  });

  private readonly usersInSelectedDepartment = computed<
    UserAndUserInOrganization[]
  >(() => {
    const deptId = this.filterDepartmentId();
    const users = this.organizationStore.users();
    if (deptId === 'all') return users;

    return users.filter((u) => {
      const dept = u.userInOrganization.department;
      return dept?.id === deptId || dept?.subDepartmentId === deptId;
    });
  });

  userFilterOptions = computed<{ id: string; name: string }[]>(() => {
    return this.usersInSelectedDepartment().map((u) => ({
      id: u.user.id,
      name: u.user.name || u.user.id,
    }));
  });

  filteredForms = computed(() => {
    return this.filterAndSortForms(this.forms());
  });

  private filterAndSortForms(forms: InventoryForm[]): InventoryForm[] {
    let filteredForms = forms;

    const searchTerm = this.searchTerm().toLowerCase();
    if (searchTerm) {
      filteredForms = filteredForms.filter(
        (form) =>
          form.formID.toLowerCase().includes(searchTerm) ||
          form.userID.toLowerCase().includes(searchTerm) ||
          (form.description &&
            form.description.toLowerCase().includes(searchTerm))
      );
    }

    const statusFilter = this.statusFilter();
    if (statusFilter !== 'all') {
      filteredForms = filteredForms.filter((form) => {
        switch (statusFilter) {
          case 'pending':
            return form.status === FormStatus.Pending;
          case 'approved':
            return form.status === FormStatus.Approved;
          case 'rejected':
            return form.status === FormStatus.Rejected;
          default:
            return true;
        }
      });
    }

    if (this.showUserFilters()) {
      const userId = this.filterUserId();
      if (userId !== 'all') {
        filteredForms = filteredForms.filter(
          (form) => form.userID === userId
        );
      } else {
        const deptId = this.filterDepartmentId();
        if (deptId !== 'all') {
          const userIdsInDept = new Set(
            this.usersInSelectedDepartment().map((u) => u.user.id)
          );
          filteredForms = filteredForms.filter((form) =>
            userIdsInDept.has(form.userID)
          );
        }
      }
    }

    const sortBy = this.sortBy();
    return [...filteredForms].sort((a, b) => {
      if (sortBy === 'newest') {
        return b.createdAtTimestamp - a.createdAtTimestamp;
      } else {
        return a.createdAtTimestamp - b.createdAtTimestamp;
      }
    });
  }

  onDepartmentChange(departmentId: string): void {
    this.filterDepartmentId.set(departmentId);
    this.filterUserId.set('all');
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.sortBy.set('newest');
    this.filterDepartmentId.set('all');
    this.filterUserId.set('all');
  }
}
