import {
  Component,
  Signal,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import {
  ReportsStore,
  UserStore,
  OrganizationStore,
  InventoryStore,
} from '../../../store';
import {
  formatJerusalemDBDate,
  InventoryItem,
  ItemReport,
} from '@equip-track/shared';

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
export class TodayReportComponent {
  reportsStore = inject(ReportsStore);
  userStore = inject(UserStore);
  organizationStore = inject(OrganizationStore);
  inventoryStore = inject(InventoryStore);

  sortBy: Signal<'location' | 'product'> = signal('product');
  private focusedCardUpi: WritableSignal<string | null> = signal(null);

  today: string;
  yesterday: string;
  todayReport = computed(() => this.reportsStore.getReport(this.today)());
  todayReportMap = computed(() => {
    return this.todayReport().reduce((acc, item) => {
      acc[`${item.productId}_${item.upi}`] = item;
      return acc;
    }, {} as Record<string, ItemReport>);
  });
  lastReport = computed(() => this.reportsStore.getReport(this.yesterday)());

  // key is productId_upi, value is last location
  lastLocationMap: Signal<Record<string, string>> = computed(() => {
    return this.lastReport().reduce((acc, item) => {
      acc[`${item.productId}_${item.upi}`] = item.location;
      return acc;
    }, {} as Record<string, string>);
  });
  userInventory = computed(() =>
    this.inventoryStore.getUserInventory(this.userStore.user()?.id)()
  );
  // TODO: we might want to let user report items of other users, if they are in their department
  // Also, admin should be able to report all items
  itemsToReport = computed(() =>
    this.userInventory().filter((item) => item.upis?.length)
  );
  itemsToShow = computed(() =>
    this.inventoryItemsToItemReports(this.itemsToReport())
  );
  sortedItems = computed(() => {
    return this.getSortedItems();
  });

  constructor() {
    const { today, yesterday } = getTodayAndYesterday();
    this.today = today;
    this.yesterday = yesterday;
  }

  getProductName(productId: string): string {
    const product = this.organizationStore.productsMap().get(productId);
    return product?.name || `Product ${productId}`;
  }

  getLastLocation(item: ItemReport): string | null {
    return this.lastLocationMap()[`${item.productId}_${item.upi}`] || null;
  }

  useLastLocation(item: ItemReport, lastLocation: string) {
    if (lastLocation) {
      item.location = lastLocation;
      this.updateItemReport(item);
    }
  }

  async updateItemReport(item: ItemReport) {
    item.location = item.location.trim();
    await this.reportsStore.updateItemReport(item);
    this.onCardBlur();
  }

  isFocused(item: ItemReport): Signal<boolean> {
    return computed(() => this.focusedCardUpi() === item.upi);
  }

  onCardFocus(item: ItemReport) {
    this.focusedCardUpi.set(item.upi);
  }

  onCardBlur() {
    this.focusedCardUpi.set(null);
  }

  isReported(item: ItemReport): Signal<boolean> {
    return computed(() => {
      const reported =
        this.todayReportMap()[`${item.productId}_${item.upi}`]?.location;
      return !!reported;
    });
  }

  shouldShowInput(item: ItemReport): Signal<boolean> {
    return computed(() => {
      return !this.isReported(item)() || this.isFocused(item)();
    });
  }

  private getItemLocationForSort(item: ItemReport): string {
    if (item.location) {
      return item.location;
    }
    return this.lastLocationMap()[`${item.productId}_${item.upi}`] || '';
  }

  clearLocation(item: ItemReport) {
    item.location = '';
  }

  getSortedItems(): ItemReport[] {
    return this.itemsToShow().sort((a, b) => {
      // Show unreported items first
      if (!a.location && b.location) {
        return -1;
      }
      if (a.location && !b.location) {
        return 1;
      }

      if (this.sortBy() === 'location') {
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

  private inventoryItemsToItemReports(items: InventoryItem[]): ItemReport[] {
    return items.flatMap((item) => this.inventoryItemToItemReports(item));
  }

  private inventoryItemToItemReports(item: InventoryItem): ItemReport[] {
    return (
      item.upis?.map((upi) => {
        const itemReport = this.todayReportMap()[`${item.productId}_${upi}`];
        if (itemReport) {
          return itemReport;
        }
        return {
          productId: item.productId,
          upi,
          location: '',
          reportedBy: '',
        };
      }) || []
    );
  }
}

function getTodayAndYesterday(): { today: string; yesterday: string } {
  const todayDate = new Date();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const today = formatJerusalemDBDate(todayDate);
  const yesterday = formatJerusalemDBDate(yesterdayDate);
  return { today, yesterday };
}
