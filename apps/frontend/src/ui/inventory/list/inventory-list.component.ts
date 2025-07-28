import {
  Component,
  inject,
  input,
  ChangeDetectionStrategy,
  TrackByFunction,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { InventoryItem } from '@equip-track/shared';
import { OrganizationStore } from '../../../store';
import { TranslateModule } from '@ngx-translate/core';
import { EmptyStateComponent } from '../../forms/empty-state/empty-state.component';
import {
  trigger,
  state,
  style,
  transition,
  animate,
  query,
  stagger,
} from '@angular/animations';

@Component({
  selector: 'inventory-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    TranslateModule,
    EmptyStateComponent,
  ],
  animations: [
    // Stagger animation for list items
    trigger('listAnimation', [
      transition('* => *', [
        query(
          ':enter',
          [
            style({
              opacity: 0,
              transform: 'translateX(-20px)',
              scale: 0.9,
            }),
            stagger(100, [
              animate(
                '400ms cubic-bezier(0.25, 0.8, 0.25, 1)',
                style({
                  opacity: 1,
                  transform: 'translateX(0)',
                  scale: 1,
                })
              ),
            ]),
          ],
          { optional: true }
        ),
      ]),
    ]),
    // Individual item hover and interaction
    trigger('itemHover', [
      state(
        'default',
        style({
          transform: 'translateY(0) scale(1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        })
      ),
      state(
        'hovered',
        style({
          transform: 'translateY(-2px) scale(1.005)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        })
      ),
      transition('default <=> hovered', [
        animate('200ms cubic-bezier(0.25, 0.8, 0.25, 1)'),
      ]),
    ]),
    // UPI expansion animation
    trigger('expandCollapse', [
      state(
        'collapsed',
        style({
          height: '0px',
          opacity: 0,
          transform: 'scaleY(0)',
          transformOrigin: 'top',
        })
      ),
      state(
        'expanded',
        style({
          height: '*',
          opacity: 1,
          transform: 'scaleY(1)',
          transformOrigin: 'top',
        })
      ),
      transition('collapsed <=> expanded', [
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)'),
      ]),
    ]),
    // Arrow rotation animation
    trigger('arrowRotation', [
      state('collapsed', style({ transform: 'rotate(0deg)' })),
      state('expanded', style({ transform: 'rotate(180deg)' })),
      transition('collapsed <=> expanded', [animate('200ms ease-in-out')]),
    ]),
    // UPI item animation
    trigger('upiItemAnimation', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateX(20px)',
          height: '0px',
        }),
        animate(
          '250ms 100ms cubic-bezier(0.25, 0.8, 0.25, 1)',
          style({
            opacity: 1,
            transform: 'translateX(0)',
            height: '*',
          })
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({
            opacity: 0,
            transform: 'translateX(-20px)',
            height: '0px',
          })
        ),
      ]),
    ]),
    // Pulse animation for quantity changes
    trigger('quantityPulse', [
      transition('* => *', [
        style({ transform: 'scale(1)' }),
        animate('150ms ease-out', style({ transform: 'scale(1.1)' })),
        animate('150ms ease-in', style({ transform: 'scale(1)' })),
      ]),
    ]),
  ],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.scss',
})
export class InventoryListComponent {
  inventoryItems = input<InventoryItem[]>();
  organizationStore = inject(OrganizationStore);

  // Track expanded state for each item
  private expandedItems = new Set<string>();

  // Track hover state for animations
  private hoveredItems = new Set<string>();

  // Performance optimization: TrackBy function for *ngFor
  readonly trackByProductId: TrackByFunction<InventoryItem> = (
    index: number,
    item: InventoryItem
  ): string => {
    return item.productId;
  };

  // Performance optimization: TrackBy function for UPI lists
  readonly trackByUpi: TrackByFunction<string> = (
    index: number,
    upi: string
  ): string => {
    return upi;
  };

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
   * Handle item hover for animations
   */
  onItemHover(item: InventoryItem, isHovered: boolean): void {
    const key = this.getItemKey(item);
    if (isHovered) {
      this.hoveredItems.add(key);
    } else {
      this.hoveredItems.delete(key);
    }
  }

  /**
   * Check if item is being hovered
   */
  isHovered(item: InventoryItem): boolean {
    return this.hoveredItems.has(this.getItemKey(item));
  }

  /**
   * Handle keyboard navigation for accessibility
   */
  onKeyDown(event: KeyboardEvent, item: InventoryItem): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (item.upis?.length) {
        this.toggleExpand(item);
      }
    }
  }

  /**
   * Get animation state for UPI expansion
   */
  getExpansionState(item: InventoryItem): string {
    return this.isExpanded(item) ? 'expanded' : 'collapsed';
  }

  /**
   * Get hover animation state
   */
  getHoverState(item: InventoryItem): string {
    return this.isHovered(item) ? 'hovered' : 'default';
  }

  /**
   * Performance optimization: Memoized product lookup
   */
  getProduct(productId: string) {
    return this.organizationStore.getProduct(productId);
  }

  /**
   * Performance optimization: Check if item has UPIs
   */
  hasUPIs(item: InventoryItem): boolean {
    return Boolean(item.upis?.length);
  }

  /**
   * Performance optimization: Get UPI count for accessibility
   */
  getUpiCount(item: InventoryItem): number {
    return item.upis?.length || 0;
  }

  /**
   * Generate a unique key for an inventory item
   */
  private getItemKey(item: InventoryItem): string {
    return `${item.productId}`;
  }
}
