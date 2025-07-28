import {
  Component,
  inject,
  OnInit,
  computed,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryListComponent } from '../list/inventory-list.component';
import { InventorySearchComponent } from '../search/inventory-search.component';
import { InventoryStore } from '../../../store/inventory.store';
import { OrganizationStore } from '../../../store/organization.store';
import { OrganizationService } from '../../../services/organization.service';

@Component({
  selector: 'inventory-by-users',
  standalone: true,
  imports: [
    CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    FormsModule,
    TranslateModule,
    InventoryListComponent,
    InventorySearchComponent,
  ],
  templateUrl: './inventory-by-users.component.html',
  styleUrls: ['./inventory-by-users.component.scss'],
})
export class InventoryByUsersComponent implements OnInit {
  inventoryStore = inject(InventoryStore);
  organizationStore = inject(OrganizationStore);
  organizationService = inject(OrganizationService);

  // Make selectedUserID a signal for reactivity
  selectedUserID = signal<string | undefined>(undefined);

  // Signal for filtered items from search component
  filteredItems = signal<any[]>([]);

  // Computed property that reacts to selectedUserID changes
  userItems = computed(() => {
    const userId = this.selectedUserID();

    // Handle WAREHOUSE special case
    if (userId === 'WAREHOUSE') {
      return this.inventoryStore.wareHouseInventory();
    }

    // Return user inventory or empty array if no user selected
    return userId ? this.inventoryStore.getUserInventory(userId) : [];
  });

  // Computed properties for users loading state
  isLoadingUsers = computed(
    () => this.organizationStore.getUsersStatus().isLoading
  );
  usersError = computed(() => this.organizationStore.getUsersStatus().error);
  hasUsers = computed(() => this.organizationStore.users().length > 0);

  constructor() {
    // Effect to fetch data when user selection changes
    effect(() => {
      const userId = this.selectedUserID();
      if (userId && userId !== 'WAREHOUSE') {
        // Fetch user inventory when a specific user is selected
        this.inventoryStore.fetchUserInventory(userId);
      }
    });
  }

  ngOnInit() {
    // Fetch initial inventory data
    this.inventoryStore.fetchInventory();

    // Fetch organization users for dropdown
    this.loadUsers();
  }

  onUserChange() {
    // No need to reassign computed - reactivity handled automatically by signals
    // The effect will trigger data fetching when selectedUserID changes
  }

  // Method to load/retry users
  loadUsers() {
    this.organizationService.getUsers();
  }

  // Handle filtered items from search component
  onFilteredItemsChange(filtered: any[]) {
    this.filteredItems.set(filtered);
  }
}
