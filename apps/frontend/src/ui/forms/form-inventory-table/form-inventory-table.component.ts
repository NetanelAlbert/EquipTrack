import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  CheckInEvent,
  InventoryForm,
  InventoryItem,
  UI_DATE_FORMAT,
  getOutstandingItems,
} from '@equip-track/shared';
import { OrganizationStore } from '../../../store/organization.store';
import { NotificationService } from '../../../services/notification.service';

/**
 * View-model for a single row in the table — one per original form item.
 * Cells are pre-computed for each check-in event in the order they appear
 * on the form, plus a final cell for the outstanding (not-yet-returned) amount.
 */
interface TableRow {
  productId: string;
  productName: string;
  hasUpi: boolean;
  /** Original check-out quantities / UPIs (before any returns). */
  takenCell: TableCell;
  /** Quantity / UPIs returned in each check-in event, in form order. */
  eventCells: TableCell[];
  /** Quantity / UPIs still outstanding (last column). */
  outstandingCell: TableCell;
}

interface TableCell {
  quantity: number;
  upis: string[];
}

@Component({
  selector: 'app-form-inventory-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, TranslateModule],
  templateUrl: './form-inventory-table.component.html',
  styleUrl: './form-inventory-table.component.scss',
})
export class FormInventoryTableComponent {
  readonly form = input.required<InventoryForm>();

  private readonly organizationStore = inject(OrganizationStore);
  private readonly clipboard = inject(Clipboard);
  private readonly notificationService = inject(NotificationService);

  readonly dateFormat = UI_DATE_FORMAT;

  private readonly expandedProductIds = signal<ReadonlySet<string>>(new Set());

  readonly checkInEvents = computed<CheckInEvent[]>(
    () => this.form().checkInEvents ?? []
  );

  readonly rows = computed<TableRow[]>(() => {
    const form = this.form();
    const events = this.checkInEvents();
    const outstanding = getOutstandingItems(form);
    const outstandingByProduct = new Map<string, InventoryItem>(
      outstanding.map((item) => [item.productId, item])
    );

    return form.items.map((item) => this.buildRow(item, events, outstandingByProduct));
  });

  isExpanded(productId: string): boolean {
    return this.expandedProductIds().has(productId);
  }

  toggleRow(productId: string, hasUpi: boolean): void {
    if (!hasUpi) {
      return;
    }
    const next = new Set(this.expandedProductIds());
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    this.expandedProductIds.set(next);
  }

  onRowKeyDown(event: KeyboardEvent, productId: string, hasUpi: boolean): void {
    if (!hasUpi) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleRow(productId, hasUpi);
    }
  }

  copyUpi(upi: string, event: MouseEvent): void {
    event.stopPropagation();
    this.clipboard.copy(upi);
    this.notificationService.showInfo('inventory.upi.copied');
  }

  private buildRow(
    item: InventoryItem,
    events: CheckInEvent[],
    outstandingByProduct: Map<string, InventoryItem>
  ): TableRow {
    const product = this.organizationStore.getProduct(item.productId);
    const hasUpi = Boolean(product?.hasUpi) || Boolean(item.upis?.length);

    const eventCells = events.map((event) => {
      const returned = event.items.filter((i) => i.productId === item.productId);
      const upis = returned.flatMap((i) => i.upis ?? []);
      const quantity = returned.reduce((sum, i) => sum + i.quantity, 0);
      return { quantity, upis } satisfies TableCell;
    });

    const outstandingItem = outstandingByProduct.get(item.productId);
    const outstandingCell: TableCell = {
      quantity: outstandingItem?.quantity ?? 0,
      upis: outstandingItem?.upis ?? [],
    };

    const takenCell: TableCell = {
      quantity: item.quantity,
      upis: item.upis ?? [],
    };

    return {
      productId: item.productId,
      productName: product?.name ?? item.productId,
      hasUpi,
      takenCell,
      eventCells,
      outstandingCell,
    };
  }
}
