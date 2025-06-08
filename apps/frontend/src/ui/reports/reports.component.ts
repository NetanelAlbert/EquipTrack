import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
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
import { ReportsStore } from '../../store/reports.store';
import { UserStore } from '../../store/user.store';
import { ItemReport } from '@equip-track/shared';
import { OrganizationStore } from '../../store/organization.store';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
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
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
})
export class ReportsComponent implements OnInit {
  reportsStore = inject(ReportsStore);
  userStore = inject(UserStore);
  organizationStore = inject(OrganizationStore);

  sortBy: 'location' | 'product' = 'product';
  sortedItems: ItemReport[] = [];
  private expandedItems = new Set<string>();

  constructor() {
    this.initializeSortingEffect();
  }

  private initializeSortingEffect() {
    effect(() => {
      this.sortItems();
    });
  }

  ngOnInit() {
    this.reportsStore.fetcReports();
  }

  getProductName(productId: string): string {
    const product = this.organizationStore.productsMap().get(productId);
    return product?.name || `Product ${productId}`;
  }

  getLastLocation(item: ItemReport): string | null {
    const lastReport = this.reportsStore.lastReport();
    const lastItem = lastReport?.items.find((i) => i.upi === item.upi);
    return lastItem?.location || null;
  }

  useLastLocation(item: ItemReport) {
    const lastLocation = this.getLastLocation(item);
    if (lastLocation) {
      item.location = lastLocation;
      this.updateItemReport(item);
    }
  }

  updateItemReport(item: ItemReport) {
    this.reportsStore.updateItemReport(item);
  }

  isExpanded(item: ItemReport): boolean {
    return this.expandedItems.has(item.upi);
  }

  private getItemsToReport(): ItemReport[] {
    const todayReport = this.reportsStore.todayReport();
    const reportedUpis = new Set(
      todayReport?.items.map((item) => item.upi) || []
    );

    const itemsToReport: ItemReport[] = [];

    this.userStore.checkedOut().forEach((item) => {
      if (item.upis) {
        item.upis.forEach((upi) => {
          if (!reportedUpis.has(upi)) {
            itemsToReport.push({
              productID: item.productID,
              upi: upi,
              location: '',
              repotedBy: this.userStore.name(),
            });
          }
        });
      }
    });

    return itemsToReport;
  }

  sortItems() {
    const todayReport = this.reportsStore.todayReport();
    const reportedItems = todayReport?.items || [];
    const itemsToReport = this.getItemsToReport();

    this.sortedItems = [...reportedItems, ...itemsToReport].sort((a, b) => {
      if (this.sortBy === 'location') {
        return this.getItemLocationForSort(a).localeCompare(
          this.getItemLocationForSort(b)
        );
      } else {
        return this.getProductName(a.productID).localeCompare(
          this.getProductName(b.productID)
        );
      }
    });
  }

  private getItemLocationForSort(item: ItemReport): string {
    if (item.location) {
      return item.location;
    }
    const lastReport = this.reportsStore.lastReport();
    const lastItem = lastReport?.items.find((i) => i.upi === item.upi);
    return lastItem?.location || '';
  }
}
