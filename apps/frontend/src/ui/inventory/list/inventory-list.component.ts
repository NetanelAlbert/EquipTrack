import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { InventoryItem } from '@equip-track/shared';
import { OrganizationStore } from '../../../store';
import { TranslateModule } from '@ngx-translate/core';
import { EmptyStateComponent } from '../../forms/empty-state/empty-state.component';

@Component({
  selector: 'inventory-list',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    TranslateModule,
    EmptyStateComponent,
  ],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.scss',
})
export class InventoryListComponent {
  inventoryItems = input<InventoryItem[]>();
  organizationStore = inject(OrganizationStore);

  // Track expanded state for each item
  private expandedItems = new Set<string>();

  /**
   * Toggle the expanded state of an inventory item
   */
  toggleExpand(item: InventoryItem): void {
    const key = this.getItemKey(item);
    if (this.expandedItems.has(key)) {
      this.expandedItems.delete(key);
    } else {
      this.expandedItems.add(key);
    }
  }

  /**
   * Check if an inventory item is expanded
   */
  isExpanded(item: InventoryItem): boolean {
    return this.expandedItems.has(this.getItemKey(item));
  }

  /**
   * Generate a unique key for an inventory item
   */
  private getItemKey(item: InventoryItem): string {
    return `${item.productId}`;
  }
}
