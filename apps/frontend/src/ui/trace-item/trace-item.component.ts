import {
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { OrganizationStore, UserStore, InventoryStore } from '../../store';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import {
  ItemReport,
  ORGANIZATION_ID_PATH_PARAM,
  OwnershipEvent,
  Product,
  UI_DATE_TIME_FORMAT,
} from '@equip-track/shared';

@Component({
  selector: 'app-trace-item',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './trace-item.component.html',
  styleUrls: ['./trace-item.component.scss'],
})
export class TraceItemComponent {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);
  organizationStore = inject(OrganizationStore);
  userStore = inject(UserStore);
  inventoryStore = inject(InventoryStore);
  translate = inject(TranslateService);

  dateTimeFormat = UI_DATE_TIME_FORMAT;

  selectedProductId = signal<string | null>(null);
  selectedUpi = signal<string | null>(null);
  isLoading = signal(false);
  reports = signal<ItemReport[]>([]);
  ownershipHistory = signal<OwnershipEvent[]>([]);
  hasSearched = signal(false);

  upiProducts = computed(() =>
    this.organizationStore.products().filter((p: Product) => p.hasUpi)
  );

  availableUpis = computed(() => {
    const productId = this.selectedProductId();
    if (!productId) return [];
    const inv = this.inventoryStore.totalInventory();
    const match = inv.find((i) => i.productId === productId);
    return match?.upis ?? [];
  });

  canSearch = computed(
    () => !!this.selectedProductId() && !!this.selectedUpi() && !this.isLoading()
  );

  displayedColumns = [
    'reportDate',
    'reportTime',
    'location',
    'holder',
    'department',
    'reporter',
  ];

  ownershipDisplayedColumns = [
    'previousHolder',
    'newHolder',
    'timestamp',
    'formType',
    'formId',
  ];

  constructor() {
    void this.inventoryStore.fetchTotalInventory();
    effect(() => {
      this.selectedProductId();
      this.selectedUpi.set(null);
      this.reports.set([]);
      this.ownershipHistory.set([]);
      this.hasSearched.set(false);
    });
  }

  onProductChange(productId: string): void {
    this.selectedProductId.set(productId);
  }

  onUpiChange(upi: string): void {
    this.selectedUpi.set(upi);
    this.reports.set([]);
    this.ownershipHistory.set([]);
    this.hasSearched.set(false);
  }

  async search(): Promise<void> {
    const productId = this.selectedProductId();
    const upi = this.selectedUpi();
    if (!productId || !upi) return;

    const organizationId = this.userStore.selectedOrganizationId();
    if (!organizationId) return;

    this.isLoading.set(true);
    this.hasSearched.set(true);

    try {
      const [reportOutcome, ownershipOutcome] = await Promise.allSettled([
        firstValueFrom(
          this.apiService.endpoints.getItemReportHistory.execute(
            { productId, upi },
            { [ORGANIZATION_ID_PATH_PARAM]: organizationId }
          )
        ),
        firstValueFrom(
          this.apiService.endpoints.getItemOwnershipHistory.execute(
            { productId, upi },
            { [ORGANIZATION_ID_PATH_PARAM]: organizationId }
          )
        ),
      ]);

      if (reportOutcome.status === 'fulfilled') {
        const response = reportOutcome.value;
        if (!response.status) {
          this.notificationService.showError(
            response.errorKey ?? 'errors.reports.fetch-failed',
            response.errorMessage ?? 'Failed to fetch item report history'
          );
          this.reports.set([]);
        } else {
          this.reports.set(response.reports);
        }
      } else {
        console.error('Error fetching item report history:', reportOutcome.reason);
        this.notificationService.handleApiError(
          reportOutcome.reason,
          'errors.reports.fetch-failed'
        );
        this.reports.set([]);
      }

      if (ownershipOutcome.status === 'fulfilled') {
        const response = ownershipOutcome.value;
        if (!response.status) {
          this.notificationService.showError(
            response.errorKey ?? 'errors.trace.ownership-fetch-failed',
            response.errorMessage ?? 'Failed to fetch ownership history'
          );
          this.ownershipHistory.set([]);
        } else {
          this.ownershipHistory.set(response.ownershipHistory);
        }
      } else {
        console.error(
          'Error fetching ownership history:',
          ownershipOutcome.reason
        );
        this.notificationService.handleApiError(
          ownershipOutcome.reason,
          'errors.trace.ownership-fetch-failed'
        );
        this.ownershipHistory.set([]);
      }
    } catch (error) {
      console.error('Error tracing item:', error);
      this.notificationService.handleApiError(
        error,
        'errors.reports.fetch-failed'
      );
      this.reports.set([]);
      this.ownershipHistory.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  getProductName(productId: string): string {
    return this.organizationStore.getProductName(productId);
  }

  getUserName(userId?: string): string {
    if (!userId) return '';
    if (userId === 'WAREHOUSE') {
      return this.translate.instant('reports.warehouse-items');
    }
    return this.organizationStore.getUserName(userId) || userId;
  }

  getDepartmentLabel(report: ItemReport): string {
    const mainId = report.departmentId;
    const subId = report.subDepartmentId;
    if (!mainId) return '';
    const main = this.userStore.getDepartmentName(mainId) ?? '';
    if (!subId) return main;
    const sub = this.userStore.getDepartmentName(subId) ?? '';
    return `${main} / ${sub}`;
  }

  formatTimestamp(report: ItemReport): string {
    if (!report.reportTimestamp) return '';
    const parsed = new Date(report.reportTimestamp);
    if (isNaN(parsed.getTime())) return report.reportTimestamp;
    return parsed.toLocaleString();
  }

  formatOwnershipTimestamp(event: OwnershipEvent): string {
    const parsed = new Date(event.timestamp);
    if (isNaN(parsed.getTime())) return String(event.timestamp);
    return parsed.toLocaleString();
  }

  ownershipFormTypeKey(formType: OwnershipEvent['formType']): string {
    return `trace.formType.${formType}`;
  }
}
