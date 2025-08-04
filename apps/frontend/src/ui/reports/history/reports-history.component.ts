import { Component, computed, inject, Signal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ReportsStore, UserStore, OrganizationStore } from '../../../store';
import {
  formatJerusalemDBDate,
  ItemReport,
  UI_DATE_FORMAT,
} from '@equip-track/shared';

@Component({
  selector: 'app-reports-history',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormsModule,
    TranslateModule,
  ],
  templateUrl: './reports-history.component.html',
  styleUrls: ['./reports-history.component.scss'],
})
export class ReportsHistoryComponent {
  reportsStore = inject(ReportsStore);
  userStore = inject(UserStore);
  organizationStore = inject(OrganizationStore);

  dateFormat = UI_DATE_FORMAT;
  sortBy: Signal<'location' | 'product'> = signal('product');
  selectedDate = signal(new Date());
  selectedDateString = computed(() => formatJerusalemDBDate(this.selectedDate()));
  selectedReport = computed(() =>
    this.reportsStore.getReport(this.selectedDateString())()
  );
  sortedItems: Signal<ItemReport[]> = computed(() =>
    this.selectedReport().sort((a, b) => {
      if (this.sortBy() === 'location') {
        return a.location.localeCompare(b.location) || 0;
      }
      return (
        this.getProductName(a.productId).localeCompare(
          this.getProductName(b.productId)
        ) || 0
      );
    })
  );
  itemCount = computed(() => this.sortedItems().length);
  hasReportForDate = computed(() => !!this.selectedReport().length);

  goToDate(date: Date) {
    this.selectedDate.set(date);
  }

  goToPreviousDay() {
    const previousDay = new Date(this.selectedDate());
    previousDay.setDate(previousDay.getDate() - 1);
    this.goToDate(previousDay);
  }

  goToNextDay() {
    const nextDay = new Date(this.selectedDate());
    nextDay.setDate(nextDay.getDate() + 1);
    this.goToDate(nextDay);
  }

  getProductName(productId: string): string {
    return this.organizationStore.getProductName(productId);
  }
}
