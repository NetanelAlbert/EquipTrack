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
import { ReportsStore } from '../../store/reports.store';
import { UserStore } from '../../store/user.store';
import { ItemReport, InventoryReport } from '@equip-track/shared';
import { OrganizationStore } from '../../store/organization.store';

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
  selectedReport: InventoryReport | null = null;
  historicalReports: InventoryReport[] = [];

  private today = new Date();
  private yesterday = new Date(this.today.getTime() - 24 * 60 * 60 * 1000);
  private twoDaysAgo = new Date(this.yesterday.getTime() - 24 * 60 * 60 * 1000);

  // Mock historical data - in real implementation this would come from the store/API
  private mockHistoricalReports: InventoryReport[] = [
    {
      organizationID: '1',
      date: this.yesterday.toISOString().split('T')[0],
      items: [
        {
          productID: '1',
          upi: '123',
          location: 'Warehouse A',
          repotedBy: 'John Doe',
        },
        {
          productID: '2',
          upi: '456',
          location: 'Warehouse B',
          repotedBy: 'Jane Smith',
        },
        {
          productID: '3',
          upi: '789',
          location: 'Office Floor 1',
          repotedBy: 'Bob Johnson',
        },
      ],
      lastUpdatedTimeStamp: Date.now() - 86400000, // Yesterday
    },
    {
      organizationID: '1',
      date: this.twoDaysAgo.toISOString().split('T')[0],
      items: [
        {
          productID: '1',
          upi: '123',
          location: 'Storage Room',
          repotedBy: 'John Doe',
        },
        {
          productID: '4',
          upi: '101',
          location: 'Lab A',
          repotedBy: 'Alice Brown',
        },
      ],
      lastUpdatedTimeStamp: Date.now() - 172800000, // 2 days ago
    },
  ];

  ngOnInit() {
    this.loadHistoricalReports();
    this.loadReportForDate(this.selectedDate);
  }

  onDateChange(date: Date) {
    this.selectedDate = date;
    this.loadReportForDate(date);
  }

  goToPreviousDay() {
    const previousDay = new Date(this.selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    this.selectedDate = previousDay;
    this.loadReportForDate(previousDay);
  }

  goToNextDay() {
    const nextDay = new Date(this.selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    this.selectedDate = nextDay;
    this.loadReportForDate(nextDay);
  }

  loadHistoricalReports() {
    // In real implementation, this would call the store/API
    this.historicalReports = this.mockHistoricalReports;
  }

  loadReportForDate(date: Date) {
    const dateString = this.formatDateToString(date);
    this.selectedReport =
      this.historicalReports.find((report) => report.date === dateString) ||
      null;
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

    this.sortedItems = [...this.selectedReport.items].sort((a, b) => {
      if (this.sortBy === 'location') {
        return a.location.localeCompare(b.location);
      } else {
        return this.getProductName(a.productID).localeCompare(
          this.getProductName(b.productID)
        );
      }
    });
  }

  getReportDate(): string {
    return this.selectedReport?.date || '';
  }

  getItemCount(): number {
    return this.selectedReport?.items.length || 0;
  }

  hasReportForDate(): boolean {
    return !!this.selectedReport;
  }
}
