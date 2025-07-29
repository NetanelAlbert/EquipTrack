import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryListComponent } from '../inventory/list/inventory-list.component';
import { InventorySearchComponent } from '../inventory/search/inventory-search.component';
import { UserStore, InventoryStore, OrganizationStore } from '../../store';
import { InventoryItem } from '@equip-track/shared';

@Component({
  selector: 'app-my-items',
  standalone: true,
  imports: [CommonModule, InventoryListComponent, InventorySearchComponent],
  templateUrl: './my-items.component.html',
  styleUrl: './my-items.component.scss',
})
export class MyItemsComponent implements OnInit {
  userStore = inject(UserStore);
  inventoryStore = inject(InventoryStore);
  organizationStore = inject(OrganizationStore);

  // Signal for filtered items from search component
  filteredItems = signal<InventoryItem[]>([]);

  // Computed property for current user's inventory items
  currentUserInventory = computed(() => {
    const userId = this.userStore.user()?.id;
    return userId ? this.inventoryStore.getUserInventory(userId) : [];
  });

  ngOnInit() {
    // Fetch user inventory on component initialization
    const userId = this.userStore.user()?.id;
    if (userId) {
      this.inventoryStore.fetchUserInventory(userId);
    }
  }

  // Handle filtered items from search component
  onFilteredItemsChange(filtered: InventoryItem[]) {
    this.filteredItems.set(filtered);
  }
}
