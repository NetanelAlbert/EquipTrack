import { Component, computed, model, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FormCardComponent } from '../form-card/form-card.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { InventoryForm, FormStatus } from '@equip-track/shared';

type StatusFilterOptions = 'all' | 'pending' | 'approved' | 'rejected';
type SortOptions = 'newest' | 'oldest';

@Component({
  selector: 'app-forms-tab-content',
  standalone: true,
  imports: [
    CommonModule,
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
  forms = input.required<InventoryForm[]>();
  emptyStateMessage = input.required<string>();

  // Search and filter models
  searchTerm = model<string>('');
  statusFilter = model<StatusFilterOptions>('pending');
  sortBy = model<SortOptions>('newest');

  // Computed property for filtered and sorted forms
  filteredForms = computed(() => {
    return this.filterAndSortForms(this.forms());
  });

  private filterAndSortForms(forms: InventoryForm[]): InventoryForm[] {
    let filteredForms = forms;

    // Apply search filter
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

    // Apply status filter
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

    // Apply sorting
    const sortBy = this.sortBy();
    return filteredForms.sort((a, b) => {
      if (sortBy === 'newest') {
        return b.createdAtTimestamp - a.createdAtTimestamp;
      } else {
        return a.createdAtTimestamp - b.createdAtTimestamp;
      }
    });
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.sortBy.set('newest');
  }
}
