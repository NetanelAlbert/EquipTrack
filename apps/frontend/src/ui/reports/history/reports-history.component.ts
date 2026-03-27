import {
  Component,
  computed,
  effect,
  inject,
  signal,
  Signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  MatMultiSort,
  MatMultiSortHeaderComponent,
} from 'ngx-mat-multi-sort';
import { ReportsMatMultiSortTableDataSource } from '../reports-mat-multi-sort-datasource';
import { ReportsStore, UserStore, OrganizationStore } from '../../../store';
import { NotificationService } from '../../../services/notification.service';
import {
  formatJerusalemDBDate,
  itemReportCompositeKey,
  UI_DATE_FORMAT,
  UserRole,
} from '@equip-track/shared';
import { LanguageService } from '../../../services/language.service';
import {
  HistoryDisplayRow,
  buildHolderByInventoryKey,
  flattenExpectedInventoryKeys,
  mergeReportedAndNotReported,
} from './reports-history.utils';
import {
  registerReportsPdfUnicodeFont,
  REPORTS_PDF_FONT_FAMILY,
} from './reports-pdf-font';
import { applyMultiColumnSort } from '../reports-multi-sort';

@Component({
  selector: 'app-reports-history',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMultiSort,
    MatMultiSortHeaderComponent,
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
  translate = inject(TranslateService);
  languageService = inject(LanguageService);
  private notificationService = inject(NotificationService);

  private multiSort = viewChild(MatMultiSort);

  private sortVersion = signal(0);
  private tableDataSource: ReportsMatMultiSortTableDataSource<HistoryDisplayRow> | null =
    null;

  readonly UserRole = UserRole;

  dateFormat = UI_DATE_FORMAT;
  selectedDate = signal(new Date());
  selectedDateString = computed(() => formatJerusalemDBDate(this.selectedDate()));
  selectedReport = computed(() =>
    this.reportsStore.getReport(this.selectedDateString())()
  );

  filterUserId = signal<string | 'all'>('all');
  filterDepartmentId = signal<string | 'all'>('all');

  canFilterByUserOrDept = computed(() => {
    const r = this.userStore.currentRole();
    return (
      r === UserRole.Admin ||
      r === UserRole.WarehouseManager ||
      r === UserRole.Inspector
    );
  });

  holderOptions = computed(() => {
    const holders = new Set<string>();
    for (const k of Object.keys(this.reportsStore.itemsToReport())) {
      holders.add(k);
    }
    return Array.from(holders).sort((a, b) =>
      this.getUserName(a).localeCompare(this.getUserName(b))
    );
  });

  departmentFilterOptions = computed(
    () => this.userStore.currentOrganization()?.departments ?? []
  );

  expectedKeys = computed(() =>
    flattenExpectedInventoryKeys(this.reportsStore.itemsToReport())
  );

  holderByKey = computed(() =>
    buildHolderByInventoryKey(this.reportsStore.itemsToReport())
  );

  mergedRows: Signal<HistoryDisplayRow[]> = computed(() =>
    mergeReportedAndNotReported(
      this.selectedReport(),
      this.expectedKeys(),
      this.holderByKey()
    )
  );

  filteredRows = computed(() => {
    let rows = this.mergedRows();
    const uid = this.filterUserId();
    const did = this.filterDepartmentId();

    if (uid !== 'all') {
      rows = rows.filter(
        (r: HistoryDisplayRow) => this.resolveHolderForRowKey(r) === uid
      );
    }

    if (did !== 'all') {
      rows = rows.filter((r: HistoryDisplayRow) => {
        const deptId = this.resolveDepartmentIdForRow(r);
        const subId = this.resolveSubDepartmentIdForRow(r);
        return deptId === did || subId === did;
      });
    }

    return rows;
  });

  sortedDisplayRows = computed(() => {
    this.sortVersion();
    if (this.tableDataSource) {
      return this.tableDataSource.data;
    }
    return this.filteredRows();
  });

  reportedCount = computed(
    () =>
      this.filteredRows().filter((r: HistoryDisplayRow) => !r.isNotReported)
        .length
  );

  totalCount = computed(() => this.filteredRows().length);

  hasReportForDate = computed(() => this.mergedRows().length > 0);

  displayedColumns = [
    'product',
    'upi',
    'status',
    'location',
    'holder',
    'department',
    'reporter',
  ];

  constructor() {
    void this.reportsStore.fetchItemsToReport();

    effect(() => {
      const sort = this.multiSort();
      const rows = this.filteredRows();
      if (!sort) {
        this.tableDataSource = null;
        return;
      }
      if (!this.tableDataSource || this.tableDataSource.sort !== sort) {
        this.tableDataSource =
          new ReportsMatMultiSortTableDataSource<HistoryDisplayRow>(
            sort,
            (data, actives, directions) =>
              applyMultiColumnSort(
                data,
                actives,
                directions,
                (a, b, columnId, dir) =>
                  this.compareHistoryRow(a, b, columnId, dir)
              )
          );
      }
      this.tableDataSource.data = [...rows];
      this.tableDataSource.orderData();
      this.sortVersion.update((v) => v + 1);
    });
  }

  onMatSortChange(): void {
    if (!this.tableDataSource) {
      return;
    }
    this.tableDataSource.orderData();
    this.sortVersion.update((v) => v + 1);
  }

  private compareHistoryRow(
    a: HistoryDisplayRow,
    b: HistoryDisplayRow,
    columnId: string,
    dir: 'asc' | 'desc'
  ): number {
    const inv = dir === 'asc' ? 1 : -1;
    let cmp = 0;
    switch (columnId) {
      case 'product':
        cmp = this.getProductName(a.productId).localeCompare(
          this.getProductName(b.productId)
        );
        break;
      case 'upi':
        cmp = (a.upi || '').localeCompare(b.upi || '');
        break;
      case 'status':
        cmp =
          (a.isNotReported ? 1 : 0) - (b.isNotReported ? 1 : 0);
        break;
      case 'location':
        cmp = (a.location || '').localeCompare(b.location || '');
        break;
      case 'holder':
        cmp = this.getSortUserLabel(a).localeCompare(
          this.getSortUserLabel(b)
        );
        break;
      case 'department':
        cmp = this.getDepartmentLabel(a).localeCompare(
          this.getDepartmentLabel(b)
        );
        break;
      case 'reporter':
        cmp = (
          a.isNotReported
            ? ''
            : this.organizationStore.getUserName(a.reportedBy)
        ).localeCompare(
          b.isNotReported
            ? ''
            : this.organizationStore.getUserName(b.reportedBy)
        );
        break;
      default:
        cmp = 0;
    }
    if (cmp !== 0) {
      return cmp * inv;
    }
    return `${a.productId}\u001f${a.upi}`.localeCompare(
      `${b.productId}\u001f${b.upi}`
    );
  }

  private resetFilters(): void {
    this.filterUserId.set('all');
    this.filterDepartmentId.set('all');
  }

  goToDate(date: Date) {
    this.selectedDate.set(date);
    this.resetFilters();
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

  getUserName(holderId: string): string {
    if (holderId === 'WAREHOUSE') {
      return this.translate.instant('reports.warehouse-items');
    }
    return this.organizationStore.getUserName(holderId) || holderId;
  }

  resolveHolderForRowKey(row: HistoryDisplayRow): string {
    const fromMap = this.holderByKey().get(
      itemReportCompositeKey(row.productId, row.upi)
    );
    if (fromMap) {
      return fromMap;
    }
    return row.ownerUserId ?? '';
  }

  resolveDepartmentIdForRow(row: HistoryDisplayRow): string | undefined {
    if (row.departmentId) {
      return row.departmentId;
    }
    const holder = this.resolveHolderForRowKey(row);
    if (!holder || holder === 'WAREHOUSE') {
      return undefined;
    }
    return this.organizationStore.getUser(holder)?.userInOrganization.department
      ?.id;
  }

  resolveSubDepartmentIdForRow(row: HistoryDisplayRow): string | undefined {
    if (row.subDepartmentId) {
      return row.subDepartmentId;
    }
    const holder = this.resolveHolderForRowKey(row);
    if (!holder || holder === 'WAREHOUSE') {
      return undefined;
    }
    return this.organizationStore.getUser(holder)?.userInOrganization.department
      ?.subDepartmentId;
  }

  getDepartmentLabel(row: HistoryDisplayRow): string {
    const mainId = this.resolveDepartmentIdForRow(row);
    const subId = this.resolveSubDepartmentIdForRow(row);
    if (!mainId) {
      return '';
    }
    const main = this.userStore.getDepartmentName(mainId) ?? '';
    if (!subId) {
      return main;
    }
    const sub = this.userStore.getDepartmentName(subId) ?? '';
    return `${main} / ${sub}`;
  }

  getSortUserLabel(row: HistoryDisplayRow): string {
    const h = this.resolveHolderForRowKey(row);
    return this.getUserName(h);
  }

  displayedTableRows(): HistoryDisplayRow[] {
    return this.sortedDisplayRows();
  }

  exportCsv(): void {
    const rows = this.displayedTableRows();
    const headers = [
      this.translate.instant('reports.columnProduct'),
      this.translate.instant('reports.upiLabel'),
      this.translate.instant('reports.columnStatus'),
      this.translate.instant('reports.enterLocation'),
      this.translate.instant('reports.columnHolder'),
      this.translate.instant('reports.columnDepartment'),
      this.translate.instant('reports.columnReporter'),
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const cols = [
        this.escapeCsv(this.getProductName(r.productId)),
        this.escapeCsv(r.upi),
        this.escapeCsv(
          r.isNotReported
            ? this.translate.instant('reports.notReportedStatus')
            : this.translate.instant('reports.reported')
        ),
        this.escapeCsv(r.location || ''),
        this.escapeCsv(this.getSortUserLabel(r)),
        this.escapeCsv(this.getDepartmentLabel(r)),
        this.escapeCsv(
          r.isNotReported
            ? ''
            : this.organizationStore.getUserName(r.reportedBy)
        ),
      ];
      lines.push(cols.join(','));
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    this.downloadBlob(
      blob,
      `report-${this.selectedDateString()}.csv`
    );
  }

  private escapeCsv(s: string): string {
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  async exportPdf(): Promise<void> {
    const isRtl = this.languageService.isRtl();
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });
    const fontOk = await registerReportsPdfUnicodeFont(doc);
    if (!fontOk) {
      this.notificationService.showError(
        'errors.reports.pdf-font-load-failed',
        'Could not load PDF font'
      );
      return;
    }
    if (isRtl) {
      doc.setR2L(true);
    }
    const title = `${this.translate.instant('reports.historyTitle')} — ${this.selectedDateString()}`;
    doc.setFont(REPORTS_PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(12);
    const pageW = doc.internal.pageSize.getWidth();
    doc.text(title, isRtl ? pageW - 40 : 40, 36, {
      align: isRtl ? 'right' : 'left',
    });

    const head = [
      [
        this.translate.instant('reports.columnProduct'),
        this.translate.instant('reports.upiLabel'),
        this.translate.instant('reports.columnStatus'),
        this.translate.instant('reports.enterLocation'),
        this.translate.instant('reports.columnHolder'),
        this.translate.instant('reports.columnDepartment'),
        this.translate.instant('reports.columnReporter'),
      ],
    ];
    const body = this.displayedTableRows().map((r) => [
      this.getProductName(r.productId),
      r.upi,
      r.isNotReported
        ? this.translate.instant('reports.notReportedStatus')
        : this.translate.instant('reports.reported'),
      r.location || '',
      this.getSortUserLabel(r),
      this.getDepartmentLabel(r),
      r.isNotReported
        ? ''
        : this.organizationStore.getUserName(r.reportedBy),
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 48,
      styles: {
        font: REPORTS_PDF_FONT_FAMILY,
        fontStyle: 'normal',
        halign: isRtl ? 'right' : 'left',
      },
      headStyles: {
        fillColor: [80, 80, 100],
        font: REPORTS_PDF_FONT_FAMILY,
        fontStyle: 'normal',
      },
    });

    doc.save(`report-${this.selectedDateString()}.pdf`);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
