import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryListComponent } from '../list/inventory-list.component';
import { InventorySearchComponent } from '../search/inventory-search.component';
import { InventoryStore } from '../../../store/inventory.store';
import { OrganizationStore } from '../../../store/organization.store';

@Component({
  selector: 'app-all-inventory',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    FormsModule,
    TranslateModule,
    InventoryListComponent,
    InventorySearchComponent,
  ],
  templateUrl: './all-inventory.component.html',
  styleUrls: ['./all-inventory.component.scss'],
})
export class AllInventoryComponent implements OnInit {
  inventoryStore = inject(InventoryStore);
  organizationStore = inject(OrganizationStore);

  // Signal for filtered items from search component
  filteredItems = signal<any[]>([]);

  // Computed properties for safer signal access
  isLoading = this.inventoryStore.loading;
  errorMessage = this.inventoryStore.error;

  // Computed property to check if inventory is empty
  hasInventory = computed(() => {
    const items = this.inventoryStore.inventory();
    return Array.isArray(items) && items.length > 0;
  });

  // Computed property to flatten inventory into a single array for search
  allInventoryItems = computed(() => {
    const inventoryRecord = this.inventoryStore.inventory();
    if (!inventoryRecord || typeof inventoryRecord !== 'object') {
      return [];
    }

    const allItems: any[] = [];
    Object.values(inventoryRecord).forEach((itemsArray) => {
      if (Array.isArray(itemsArray)) {
        allItems.push(...itemsArray);
      }
    });

    return allItems;
  });

  ngOnInit() {
    this.loadInventory();
  }

  // Method to load/retry inventory
  loadInventory() {
    this.inventoryStore.fetchInventory();
  }

  // Handle filtered items from search component
  onFilteredItemsChange(filtered: any[]) {
    this.filteredItems.set(filtered);
  }
}
