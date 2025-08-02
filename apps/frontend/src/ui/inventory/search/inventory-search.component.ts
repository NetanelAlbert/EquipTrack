import {
  Component,
  output,
  input,
  computed,
  signal,
  effect,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryItem, Product } from '@equip-track/shared';
import {
  trigger,
  state,
  style,
  transition,
  animate,
  keyframes,
} from '@angular/animations';
import { OrganizationStore } from '../../../store/organization.store';

export interface InventorySearchFilters {
  searchTerm: string;
  sortBy: 'productId' | 'quantity' | 'name';
  sortDirection: 'asc' | 'desc';
  minQuantity?: number;
  maxQuantity?: number;
}

@Component({
  selector: 'inventory-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatChipsModule,
    FormsModule,
    TranslateModule,
  ],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateY(-20px)', opacity: 0 }),
        animate(
          '300ms ease-out',
          style({ transform: 'translateY(0)', opacity: 1 })
        ),
      ]),
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-in', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('200ms ease-out', style({ opacity: 0 }))]),
    ]),
    trigger('pulseButton', [
      state('active', style({ transform: 'scale(1.05)' })),
      state('inactive', style({ transform: 'scale(1)' })),
      transition('inactive => active', [
        animate('150ms ease-out', style({ transform: 'scale(1.05)' })),
      ]),
      transition('active => inactive', [
        animate('150ms ease-in', style({ transform: 'scale(1)' })),
      ]),
    ]),
    trigger('countChange', [
      transition('* => *', [
        animate(
          '300ms ease-in-out',
          keyframes([
            style({ transform: 'scale(1)', offset: 0 }),
            style({ transform: 'scale(1.1)', offset: 0.5 }),
            style({ transform: 'scale(1)', offset: 1 }),
          ])
        ),
      ]),
    ]),
  ],
  template: `
    <div class="search-container" @slideIn>
      <!-- Search Input -->
      <mat-form-field class="search-field" appearance="outline">
        <mat-label>{{ 'inventory.search.placeholder' | translate }}</mat-label>
        <input
          matInput
          [ngModel]="searchTerm()"
          (ngModelChange)="searchTerm.set($event)"
          (keydown)="onKeyDown($event)"
          [placeholder]="'inventory.search.placeholder' | translate"
          #searchInput
        />
        <mat-icon matSuffix>search</mat-icon>
        @if (searchTerm()) {
        <button
          matSuffix
          mat-icon-button
          (click)="clearSearch()"
          [attr.aria-label]="'inventory.search.clear' | translate"
          [@pulseButton]="searchTerm() ? 'active' : 'inactive'"
          @fadeIn
        >
          <mat-icon>clear</mat-icon>
        </button>
        }
      </mat-form-field>

      <!-- UPI Filter -->
      <mat-form-field class="upi-field" appearance="outline">
        <mat-label>{{ 'inventory.search.type' | translate }}</mat-label>
        <mat-select
          [ngModel]="upiFilter()"
          (ngModelChange)="upiFilter.set($event)"
        >
          <mat-option value="all">{{
            'inventory.search.typeAll' | translate
          }}</mat-option>
          <mat-option value="upi">{{
            'inventory.search.typeUpi' | translate
          }}</mat-option>
          <mat-option value="non-upi">{{
            'inventory.search.typeNonUpi' | translate
          }}</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Sort Options -->
      <mat-form-field class="sort-field" appearance="outline">
        <mat-label>{{ 'inventory.search.sortBy' | translate }}</mat-label>
        <mat-select [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event)">
          <mat-option value="productId">{{
            'inventory.search.sortByProductId' | translate
          }}</mat-option>
          <mat-option value="quantity">{{
            'inventory.search.sortByQuantity' | translate
          }}</mat-option>
          <mat-option value="name">{{
            'inventory.search.sortByName' | translate
          }}</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Sort Direction -->
      <button
        mat-icon-button
        (click)="toggleSortDirection()"
        [attr.aria-label]="'inventory.search.sortDirection' | translate"
        class="sort-direction-btn"
        [@pulseButton]="'inactive'"
        (mouseenter)="onButtonHover(true)"
        (mouseleave)="onButtonHover(false)"
        [title]="
          (sortDirection() === 'asc'
            ? 'inventory.search.sortAscending'
            : 'inventory.search.sortDescending'
          ) | translate
        "
      >
        <mat-icon>{{
          sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward'
        }}</mat-icon>
      </button>

      <!-- Results Count -->
      @if (resultCount() !== null) {
      <div class="results-count" [@countChange]="resultCount()" @fadeIn>
        {{ 'inventory.search.results' | translate : { count: resultCount() } }}
      </div>
      }

      <!-- Clear All Filters -->
      @if (hasActiveFilters()) {
      <button
        mat-stroked-button
        (click)="clearAllFilters()"
        class="clear-filters-btn"
        [@pulseButton]="'inactive'"
        @fadeIn
        [attr.aria-label]="'inventory.search.clearFilters' | translate"
      >
        <mat-icon>clear_all</mat-icon>
        {{ 'inventory.search.clearFilters' | translate }}
      </button>
      }
    </div>
  `,
  styles: [
    `
      .search-container {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 8px;
        margin-bottom: 16px;
        transition: all 300ms ease-in-out;
      }

      .search-container:hover {
        background: rgba(0, 0, 0, 0.04);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .search-field {
        flex: 1;
        min-width: 300px;
        transition: all 200ms ease-in-out;
      }

      .search-field:focus-within {
        transform: translateY(-2px);
      }

      .sort-field {
        min-width: 150px;
        transition: all 200ms ease-in-out;
      }

      .sort-direction-btn {
        margin-top: -8px;
        transition: all 200ms ease-in-out;
      }

      .sort-direction-btn:hover {
        background-color: rgba(0, 0, 0, 0.04);
        transform: scale(1.1);
      }

      .results-count {
        color: #666;
        font-size: 14px;
        white-space: nowrap;
        padding: 8px 12px;
        background: rgba(25, 118, 210, 0.1);
        border-radius: 16px;
        transition: all 200ms ease-in-out;
      }

      .clear-filters-btn {
        margin-left: auto;
        transition: all 200ms ease-in-out;
      }

      .clear-filters-btn:hover {
        background-color: rgba(244, 67, 54, 0.1);
        color: #f44336;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(244, 67, 54, 0.2);
      }

      @media (max-width: 768px) {
        .search-container {
          flex-direction: column;
          align-items: stretch;
        }

        .search-field {
          min-width: unset;
        }

        .results-count {
          text-align: center;
        }

        .clear-filters-btn {
          margin-left: 0;
        }
      }

      /* Focus trap and accessibility enhancements */
      .search-field input:focus {
        outline: 2px solid #1976d2;
        outline-offset: 2px;
      }

      /* Keyboard navigation indicators */
      button:focus-visible {
        outline: 2px solid #1976d2;
        outline-offset: 2px;
      }
    `,
  ],
})
export class InventorySearchComponent {
  // Input properties
  items = input.required<InventoryItem[]>();
  productsMap = input.required<Map<string, Product>>();
  // Output events
  filteredItems = output<InventoryItem[]>();
  filtersChanged = output<InventorySearchFilters>();

  organizationStore = inject(OrganizationStore);

  // Internal state signals
  searchTerm = signal('');
  upiFilter = signal<'all' | 'upi' | 'non-upi'>('all');
  sortBy = signal<'productId' | 'quantity' | 'name'>('productId');
  sortDirection = signal<'asc' | 'desc'>('asc');
  resultCount = signal<number | null>(null);

  // Computed properties
  hasActiveFilters = computed(() => {
    return (
      this.searchTerm() !== '' ||
      this.sortBy() !== 'productId' ||
      this.sortDirection() !== 'asc'
    );
  });

  filteredAndSortedItems = computed(() => {
    let filtered = this.items();

    // Apply upi filter
    if (this.upiFilter() !== 'all') {
      const filterFunction =
        this.upiFilter() === 'upi'
          ? (id: string) => this.organizationStore.isProductUpi(id)
          : (id: string) => !this.organizationStore.isProductUpi(id);
      filtered = filtered.filter((item) => {
        return filterFunction(item.productId);
      });
    }

    // Apply search filter
    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      filtered = filtered.filter(
        (item) =>
          item.productId.toLowerCase().includes(search) ||
          this.productsMap()
            .get(item.productId)
            ?.name.toLowerCase()
            .includes(search) ||
          (item.upis &&
            item.upis.some((upi) => upi.toLowerCase().includes(search)))
      );
    }

    // Apply sorting
    const sortBy = this.sortBy();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;

    filtered = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'productId':
          aValue = a.productId.toLowerCase();
          bValue = b.productId.toLowerCase();
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'name':
          aValue = this.productsMap().get(a.productId)?.name.toLowerCase();
          bValue = this.productsMap().get(b.productId)?.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });

    return filtered;
  });

  constructor() {
    // Effect to emit filtered items when they change
    effect(
      () => {
        const filtered = this.filteredAndSortedItems();
        this.resultCount.set(filtered.length);
        this.filteredItems.emit(filtered);
      },
      { allowSignalWrites: true }
    );

    // Effect to emit filter changes
    effect(() => {
      const filters: InventorySearchFilters = {
        searchTerm: this.searchTerm(),
        sortBy: this.sortBy(),
        sortDirection: this.sortDirection(),
      };
      this.filtersChanged.emit(filters);
    });
  }

  clearSearch() {
    this.searchTerm.set('');
  }

  toggleSortDirection() {
    this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
  }

  clearAllFilters() {
    this.searchTerm.set('');
    this.sortBy.set('productId');
    this.sortDirection.set('asc');
  }

  // Keyboard shortcuts and interactions
  onKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'Escape':
        if (this.searchTerm()) {
          this.clearSearch();
        } else if (this.hasActiveFilters()) {
          this.clearAllFilters();
        }
        break;
      case 'Enter':
        if (event.ctrlKey || event.metaKey) {
          this.toggleSortDirection();
        }
        break;
      case 'ArrowDown':
        if (event.ctrlKey) {
          event.preventDefault();
          this.sortDirection.set('desc');
        }
        break;
      case 'ArrowUp':
        if (event.ctrlKey) {
          event.preventDefault();
          this.sortDirection.set('asc');
        }
        break;
    }
  }

  onButtonHover(isHovered: boolean) {
    // This method is used for button hover state management
    // Currently used for animation triggers, can be extended for more complex interactions
  }
}
