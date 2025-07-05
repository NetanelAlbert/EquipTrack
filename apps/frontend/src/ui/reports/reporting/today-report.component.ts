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
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ReportsStore, UserStore, OrganizationStore } from '../../../store';
import { ItemReport } from '@equip-track/shared';

@Component({
  selector: 'app-today-report',
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
    FormsModule,
    TranslateModule,
  ],
  templateUrl: './today-report.component.html',
  styleUrls: ['./today-report.component.scss'],
})
export class TodayReportComponent implements OnInit {
  reportsStore = inject(ReportsStore);
  userStore = inject(UserStore);
  organizationStore = inject(OrganizationStore);

  sortBy: 'location' | 'product' = 'product';
  sortedItems: ItemReport[] = [];
  private expandedItems = new Set<string>();
  private focusedCardUpi: string | null = null;

  ngOnInit() {
    this.reportsStore.fetcReports();
    this.sortItems();
  }

  getProductName(productId: string): string {
    const product = this.organizationStore.productsMap().get(productId);
    return product?.name || `Product ${productId}`;
  }

  getLastLocation(item: ItemReport): string | null {
    const lastReport = this.reportsStore.lastReport();
    const lastItem = lastReport?.find((i) => i.upi === item.upi);
    return lastItem?.location || null;
  }

  useLastLocation(item: ItemReport, lastLocation: string) {
    if (lastLocation) {
      item.location = lastLocation;
      this.updateItemReport(item);
      this.onCardBlur();
    }
  }

  updateItemReport(item: ItemReport) {
    item.location = item.location.trim();
    this.reportsStore.updateItemReport(item);
  }

  isExpanded(item: ItemReport): boolean {
    return this.expandedItems.has(item.upi);
  }

  isFocused(item: ItemReport): boolean {
    return this.focusedCardUpi === item.upi;
  }

  onCardFocus(item: ItemReport) {
    this.focusedCardUpi = item.upi;
  }

  onCardBlur() {
    this.focusedCardUpi = null;
    this.sortItems();
  }

  shouldShowInput(item: ItemReport): boolean {
    return !item.location || this.isFocused(item);
  }

  private getItemsToReport(): ItemReport[] {
    const todayReport = this.reportsStore.todayReport();
    const reportedUpis = new Set(
      todayReport?.map((item) => item.upi) || []
    );

    const itemsToReport: ItemReport[] = [];

    this.userStore.checkedOut().forEach((item) => {
      if (item.upis) {
        item.upis.forEach((upi) => {
          if (!reportedUpis.has(upi)) {
            itemsToReport.push({
              productId: item.productId,
              upi: upi,
              location: '',
              reportedBy: this.userStore.name(),
            });
          }
        });
      }
    });

    return itemsToReport;
  }

  sortItems() {
    const todayReport = this.reportsStore.todayReport();
    const reportedItems = todayReport || [];
    const itemsToReport = this.getItemsToReport();

    this.sortedItems = [...reportedItems, ...itemsToReport].sort((a, b) => {
      if (this.sortBy === 'location') {
        return this.getItemLocationForSort(a).localeCompare(
          this.getItemLocationForSort(b)
        );
      } else {
        return this.getProductName(a.productId).localeCompare(
          this.getProductName(b.productId)
        );
      }
    });
  }

  private getItemLocationForSort(item: ItemReport): string {
    if (item.location) {
      return item.location;
    }
    const lastReport = this.reportsStore.lastReport();
    const lastItem = lastReport?.find((i) => i.upi === item.upi);
    return lastItem?.location || '';
  }

  clearLocation(item: ItemReport) {
    item.location = '';
    this.updateItemReport(item);
  }
}
