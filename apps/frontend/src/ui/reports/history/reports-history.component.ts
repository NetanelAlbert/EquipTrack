import { Component, OnInit, inject } from '@angular/core';
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
import { ItemReport } from '@equip-track/shared';

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
export class ReportsHistoryComponent implements OnInit {
  reportsStore = inject(ReportsStore);
  userStore = inject(UserStore);
  organizationStore = inject(OrganizationStore);

  selectedDate: Date = new Date();
  sortBy: 'location' | 'product' = 'product';
  sortedItems: ItemReport[] = [];
  selectedReport: ItemReport[] | null = null;

  private today = new Date();
  private yesterday = new Date(this.today.getTime() - 24 * 60 * 60 * 1000);
  private twoDaysAgo = new Date(this.yesterday.getTime() - 24 * 60 * 60 * 1000);

  ngOnInit() {
    this.loadReportForDate(this.selectedDate);
  }

  onDateChange(date: Date) {
    this.selectedDate = date;
    this.loadReportForDate(date);
  }

  goToPreviousDay() {
    const previousDay = new Date(this.selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    this.onDateChange(previousDay);
  }

  goToNextDay() {
    const nextDay = new Date(this.selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    this.onDateChange(nextDay);
  }

  loadReportForDate(date: Date) {
    const dateString = this.formatDateToString(date);
    this.selectedReport = this.reportsStore.reportsByDate().get(dateString) || null;
    this.sortItems();
  }

  private formatDateToString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  getProductName(productId: string): string {
    const product = this.organizationStore.productsMap().get(productId);
    return product?.name || `Product ${productId}`;
  }

  sortItems() {
    if (!this.selectedReport) {
      this.sortedItems = [];
      return;
    }

    this.sortedItems = [...this.selectedReport].sort((a, b) => {
      if (this.sortBy === 'location') {
        return a.location.localeCompare(b.location);
      } else {
        return this.getProductName(a.productId).localeCompare(
          this.getProductName(b.productId)
        );
      }
    });
  }

  getReportDate(): string {
    return this.formatDateToString(this.selectedDate);
  }

  getItemCount(): number {
    return this.selectedReport?.length || 0;
  }

  hasReportForDate(): boolean {
    return !!this.selectedReport;
  }
}
