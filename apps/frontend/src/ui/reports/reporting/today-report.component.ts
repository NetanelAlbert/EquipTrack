import {
  Component,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  MatMultiSort,
  MatMultiSortHeaderComponent,
} from 'ngx-mat-multi-sort';
import { ReportsStore, UserStore, OrganizationStore } from '../../../store';
import {
  formatJerusalemDBDate,
  InventoryItem,
  ItemReport,
  itemReportCompositeKey,
  UserRole,
} from '@equip-track/shared';
import { ReportsMultiSortDataSource } from '../reports-multi-sort-datasource';

export interface TodayReportRow {
  holderId: string;
  item: ItemReport;
}

@Component({
  selector: 'app-today-report',
  standalone: true,
  imports: [
    MatTableModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatMultiSort,
    MatMultiSortHeaderComponent,
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
  translateService = inject(TranslateService);

  readonly UserRole = UserRole;

  filterHolderId: WritableSignal<string | 'all'> = signal('all');
  filterDepartmentId: WritableSignal<string | 'all'> = signal('all');

  private focusedCardUpi: WritableSignal<string | null> = signal(null);
  private editTransitionPending = false;
  private selectedUpis: WritableSignal<Set<string>> = signal(new Set());

  multiSort = viewChild(MatMultiSort);
  reportDataSource?: ReportsMultiSortDataSource<TodayReportRow>;

  tableDataSource(): TodayReportRow[] | ReportsMultiSortDataSource<TodayReportRow> {
    return this.reportDataSource ?? this.tableRows();
  }

  today: string;
  yesterday: string;
  todayReport = computed(() => this.reportsStore.getReport(this.today)());
  todayReportMap = computed(() => {
    return this.todayReport().reduce((acc, item) => {
      acc[itemReportCompositeKey(item.productId, item.upi)] = item;
      return acc;
    }, {} as Record<string, ItemReport>);
  });
  lastReport = computed(() => this.reportsStore.getReport(this.yesterday)());

  lastLocationMap: Signal<Record<string, string>> = computed(() => {
    return this.lastReport().reduce((acc, item) => {
      acc[itemReportCompositeKey(item.productId, item.upi)] = item.location;
      return acc;
    }, {} as Record<string, string>);
  });

  canUsePrivilegedFilters = computed(() => {
    const role = this.userStore.currentRole();
    return role === UserRole.Admin || role === UserRole.WarehouseManager;
  });

  holderOptions = computed(() => {
    const holders = new Set<string>();
    for (const [holderId] of this.inventoryItemsByHolderToItemReports(
      this.reportsStore.itemsToReport()
    )) {
      holders.add(holderId);
    }
    return Array.from(holders).sort((a, b) =>
      this.getUserName(a).localeCompare(this.getUserName(b))
    );
  });

  departmentFilterOptions = computed(() => {
    const org = this.userStore.currentOrganization();
    return org?.departments ?? [];
  });

  itemsToShow: Signal<Array<[string, ItemReport[]]>> = computed(() =>
    this.inventoryItemsByHolderToItemReports(this.reportsStore.itemsToReport())
  );

  filteredItemsToShow: Signal<Array<[string, ItemReport[]]>> = computed(() => {
    let sections = this.itemsToShow();
    const holderFilter = this.filterHolderId();
    const deptFilter = this.filterDepartmentId();

    if (this.canUsePrivilegedFilters()) {
      if (holderFilter !== 'all') {
        sections = sections.filter(([id]) => id === holderFilter);
      }
      if (deptFilter !== 'all') {
        sections = sections.filter(([holderId]) => {
          if (holderId === 'WAREHOUSE') {
            return false;
          }
          const dept =
            this.organizationStore.getUser(holderId)?.userInOrganization
              .department;
          if (!dept) {
            return false;
          }
          return (
            dept.id === deptFilter || dept.subDepartmentId === deptFilter
          );
        });
      }
    }

    return sections;
  });

  /** Flat rows in section order; table multi-sort applies on top. */
  tableRows: Signal<TodayReportRow[]> = computed(() => {
    const rows: TodayReportRow[] = [];
    for (const [holderId, items] of this.filteredItemsToShow()) {
      for (const item of items) {
        rows.push({ holderId, item });
      }
    }
    return rows;
  });

  rowsWithLocation = computed(() =>
    this.tableRows().filter((r) => !!r.item.location?.trim())
  );

  allLocationRowsSelected = computed(() => {
    const withLoc = this.rowsWithLocation();
    if (withLoc.length === 0) {
      return false;
    }
    return withLoc.every((r) => this.isRowSelected(r));
  });

  someLocationRowsSelected = computed(() => {
    const withLoc = this.rowsWithLocation();
    const n = withLoc.filter((r) => this.isRowSelected(r)).length;
    return n > 0 && n < withLoc.length;
  });

  displayedColumns = computed(() => {
    if (this.canUsePrivilegedFilters()) {
      return [
        'select',
        'holder',
        'department',
        'product',
        'upi',
        'status',
        'lastLocation',
        'location',
        'actions',
      ];
    }
    return [
      'select',
      'product',
      'upi',
      'status',
      'lastLocation',
      'location',
      'actions',
    ];
  });

  constructor() {
    this.reportsStore.fetchItemsToReport();
    const { today, yesterday } = getTodayAndYesterday();
    this.today = today;
    this.yesterday = yesterday;

    effect(() => {
      this.multiSort();
      this.tableRows();
      queueMicrotask(() => this.syncReportDataSource());
    });
  }

  private initDataSourceIfNeeded(): void {
    if (this.reportDataSource) {
      return;
    }
    const ms = this.multiSort();
    if (!ms) {
      return;
    }
    this.reportDataSource = new ReportsMultiSortDataSource<TodayReportRow>(
      ms,
      (a, b, columnId, dir) => {
        const inv = dir === 'asc' ? 1 : -1;
        let cmp = 0;
        switch (columnId) {
          case 'holder':
            cmp = this.getUserName(a.holderId).localeCompare(
              this.getUserName(b.holderId)
            );
            break;
          case 'department':
            cmp = this.getDepartmentLabelForRow(a).localeCompare(
              this.getDepartmentLabelForRow(b)
            );
            break;
          case 'product':
            cmp = this.getProductName(a.item.productId).localeCompare(
              this.getProductName(b.item.productId)
            );
            break;
          case 'upi':
            cmp = (a.item.upi || '').localeCompare(b.item.upi || '');
            break;
          case 'status':
            cmp =
              (this.isReportedItem(a.item) ? 1 : 0) -
              (this.isReportedItem(b.item) ? 1 : 0);
            break;
          case 'lastLocation':
            cmp = (this.getLastLocation(a.item) || '').localeCompare(
              this.getLastLocation(b.item) || ''
            );
            break;
          case 'location':
            cmp = (a.item.location || '').localeCompare(b.item.location || '');
            break;
          default:
            cmp = 0;
        }
        return cmp * inv;
      },
      (a, b) => this.rowKey(a).localeCompare(this.rowKey(b))
    );
  }

  onMultiSortChange(): void {
    this.syncReportDataSource();
  }

  private syncReportDataSource(): void {
    this.initDataSourceIfNeeded();
    if (!this.reportDataSource) {
      return;
    }
    this.reportDataSource.data = this.tableRows();
    this.reportDataSource.orderData();
  }

  rowKey(row: TodayReportRow): string {
    return `${row.holderId}\u001f${itemReportCompositeKey(
      row.item.productId,
      row.item.upi
    )}`;
  }

  isRowSelected(row: TodayReportRow): boolean {
    return this.selectedUpis().has(this.rowKey(row));
  }

  toggleRowSelection(row: TodayReportRow, checked: boolean): void {
    const key = this.rowKey(row);
    const next = new Set(this.selectedUpis());
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.selectedUpis.set(next);
  }

  toggleSelectAll(checked: boolean): void {
    if (!checked) {
      this.selectedUpis.set(new Set());
      return;
    }
    const next = new Set<string>();
    for (const row of this.tableRows()) {
      if (row.item.location?.trim()) {
        next.add(this.rowKey(row));
      }
    }
    this.selectedUpis.set(next);
  }

  async publishSelected(): Promise<void> {
    const rows = this.tableRows().filter((r) => this.isRowSelected(r));
    const items = rows
      .map((r) => r.item)
      .filter((i) => i.location?.trim());
    if (items.length === 0) {
      return;
    }
    await this.reportsStore.updateItemsReport(items);
    this.selectedUpis.set(new Set());
  }

  getProductName(productId: string): string {
    const product = this.organizationStore.productsMap().get(productId);
    return product?.name || `Product ${productId}`;
  }

  getLastLocation(item: ItemReport): string | null {
    return (
      this.lastLocationMap()[itemReportCompositeKey(item.productId, item.upi)] ||
      null
    );
  }

  useLastLocation(item: ItemReport, lastLocation: string) {
    if (lastLocation) {
      item.location = lastLocation;
      this.onRowFocus(item);
    }
  }

  async updateItemReport(item: ItemReport) {
    item.location = item.location.trim();
    await this.reportsStore.updateItemReport(item);
    this.onCardBlur();
  }

  itemFocusKey(item: ItemReport): string {
    return itemReportCompositeKey(item.productId, item.upi);
  }

  isFocusedItem(item: ItemReport): boolean {
    return this.focusedCardUpi() === this.itemFocusKey(item);
  }

  onRowFocus(item: ItemReport) {
    this.editTransitionPending = true;
    this.focusedCardUpi.set(this.itemFocusKey(item));
    setTimeout(() => {
      this.editTransitionPending = false;
    });
  }

  onCardBlur() {
    this.focusedCardUpi.set(null);
  }

  onLocationCellBlur(event: FocusEvent, item: ItemReport): void {
    if (this.editTransitionPending) {
      return;
    }
    const next = event.relatedTarget as Node | null;
    const cell = event.currentTarget as HTMLElement | null;
    if (cell && next && cell.contains(next)) {
      return;
    }
    if (this.focusedCardUpi() === this.itemFocusKey(item)) {
      this.onCardBlur();
    }
  }

  isReportedItem(item: ItemReport): boolean {
    return !!this.todayReportMap()[
      itemReportCompositeKey(item.productId, item.upi)
    ]?.location;
  }

  shouldShowInput(item: ItemReport): boolean {
    return !this.isReportedItem(item) || this.isFocusedItem(item);
  }

  autoSelectRow(row: TodayReportRow): void {
    const shouldSelect = !!row.item.location?.trim();
    if (shouldSelect !== this.isRowSelected(row)) {
      this.toggleRowSelection(row, shouldSelect);
    }
  }

  clearLocation(item: ItemReport) {
    item.location = '';
  }

  private inventoryItemsByHolderToItemReports(
    itemsByHolder: Record<string, InventoryItem[]>
  ): Array<[string, ItemReport[]]> {
    const itemsByHolderCopy = { ...itemsByHolder };
    const result: Array<[string, ItemReport[]]> = [];
    const myUserId = this.userStore.user()?.id ?? '';

    if (itemsByHolderCopy[myUserId]) {
      result.push([
        myUserId,
        this.inventoryItemsToItemReports(itemsByHolderCopy[myUserId]),
      ]);
      delete itemsByHolderCopy[myUserId];
    }

    if (itemsByHolderCopy['WAREHOUSE']) {
      result.push([
        'WAREHOUSE',
        this.inventoryItemsToItemReports(itemsByHolderCopy['WAREHOUSE']),
      ]);
      delete itemsByHolderCopy['WAREHOUSE'];
    }

    for (const [holderId, items] of Object.entries(itemsByHolderCopy)) {
      result.push([holderId, this.inventoryItemsToItemReports(items)]);
    }

    return result;
  }

  private inventoryItemsToItemReports(
    inventoryItems: InventoryItem[]
  ): ItemReport[] {
    return inventoryItems.flatMap((item) => this.inventoryItemToItemReports(item));
  }

  private inventoryItemToItemReports(item: InventoryItem): ItemReport[] {
    return (
      item.upis?.map((upi) => {
        const itemReport =
          this.todayReportMap()[itemReportCompositeKey(item.productId, upi)];
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

  getUserName(holderId: string): string {
    if (holderId === this.userStore.user()?.id) {
      return this.translateService.instant('reports.my-items');
    }
    if (holderId === 'WAREHOUSE') {
      return this.translateService.instant('reports.warehouse-items');
    }
    return this.organizationStore.getUserName(holderId);
  }

  getHolderDepartmentLabel(holderId: string): string {
    if (!holderId || holderId === 'WAREHOUSE') {
      return '';
    }
    const user = this.organizationStore.getUser(holderId);
    const department = user?.userInOrganization.department;
    if (!department) {
      return '';
    }
    const main = this.userStore.getDepartmentName(department.id) ?? '';
    if (!department.subDepartmentId) {
      return main;
    }
    const sub =
      this.userStore.getDepartmentName(department.subDepartmentId) ?? '';
    return `${main} / ${sub}`;
  }

  getDepartmentLabelForRow(row: TodayReportRow): string {
    return this.getHolderDepartmentLabel(row.holderId);
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
