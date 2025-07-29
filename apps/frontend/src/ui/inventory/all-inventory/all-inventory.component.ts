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
import { InventoryItem } from '@equip-track/shared';

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
  allInventoryItems = this.inventoryStore.totalOrganizationItems;
  filteredItems = signal<InventoryItem[]>([]);
  hasInventory = computed(() => this.allInventoryItems().length > 0);
  isLoading = computed(() => this.inventoryStore.fetchInventoryStatus().isLoading);
  errorMessage = computed(() => this.inventoryStore.fetchInventoryStatus().error);

  ngOnInit() {
    this.loadInventory();
  }

  loadInventory() {
    this.inventoryStore.fetchInventory();
  }

  onFilteredItemsChange(filtered: InventoryItem[]) {
    this.filteredItems.set(filtered);
  }
}
