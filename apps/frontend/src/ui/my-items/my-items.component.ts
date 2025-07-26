import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryListComponent } from '../inventory/list/inventory-list.component';
import { InventorySearchComponent } from '../inventory/search/inventory-search.component';
import { UserStore, InventoryStore } from '../../store';

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

  // Signal for filtered items from search component
  filteredItems = signal<any[]>([]);

  // Computed property for current user's inventory items
  currentUserInventory = computed(() => {
    const userId = this.userStore.user()?.id;
    return userId ? this.inventoryStore.getUserInventory(userId) : [];
  });

  ngOnInit() {
    // Fetch user inventory on component initialization
    this.inventoryStore.fetchInventory();
  }

  // Handle filtered items from search component
  onFilteredItemsChange(filtered: any[]) {
    this.filteredItems.set(filtered);
  }
}
