import {
  Component,
  inject,
  OnInit,
  computed,
  signal,
  effect,
  Signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryStore } from '../../../store/inventory.store';
import { OrganizationStore } from '../../../store/organization.store';
import { OrganizationService } from '../../../services/organization.service';
import { InventoryItem, Product, UserAndUserInOrganization } from '@equip-track/shared';

interface TableData {
  product: Product;
  userColumns: { [userId: string]: InventoryItem | null };
  hasUpi: boolean;
}

interface UserColumn {
  userId: string;
  userName: string;
  department?: string;
}

@Component({
  selector: 'inventory-by-users',
  standalone: true,
  imports: [
    CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    FormsModule,
    TranslateModule,
  ],
  templateUrl: './inventory-by-users.component.html',
  styleUrls: ['./inventory-by-users.component.scss'],
})
export class InventoryByUsersComponent implements OnInit {
  inventoryStore = inject(InventoryStore);
  organizationStore = inject(OrganizationStore);
  organizationService = inject(OrganizationService);

  // Selected user IDs for columns
  selectedUserIds = signal<string[]>(['WAREHOUSE']);
  availableUsers = signal<UserAndUserInOrganization[]>([]);
  
  // Computed table data
  tableData: Signal<TableData[]> = computed(() => {
    const products = this.organizationStore.products();
    const productsMap = this.organizationStore.productsMap();
    const selectedUsers = this.selectedUserIds();
    
    // Get all products that have inventory in any selected user
    const productIds = new Set<string>();
    
    selectedUsers.forEach(userId => {
      const userInventory = this.inventoryStore.getUserInventory(userId)();
      userInventory.forEach(item => productIds.add(item.productId));
    });
    
    // Create table rows for each product
    const tableRows: TableData[] = [];
    
    productIds.forEach(productId => {
      const product = productsMap()[productId];
      if (!product) return;
      
      const userColumns: { [userId: string]: InventoryItem | null } = {};
      
      selectedUsers.forEach(userId => {
        const userInventory = this.inventoryStore.getUserInventory(userId)();
        const item = userInventory.find(inv => inv.productId === productId);
        userColumns[userId] = item || null;
      });
      
      tableRows.push({
        product,
        userColumns,
        hasUpi: product.hasUpi
      });
    });
    
    return tableRows.sort((a, b) => a.product.name.localeCompare(b.product.name));
  });
  
  // User columns for table headers
  userColumns: Signal<UserColumn[]> = computed(() => {
    const selectedUsers = this.selectedUserIds();
    const organizationUsers = this.organizationStore.users();
    
    return selectedUsers.map(userId => {
      if (userId === 'WAREHOUSE') {
        return {
          userId: 'WAREHOUSE',
          userName: 'Warehouse',
          department: undefined
        };
      }
      
      const userInOrg = organizationUsers.find(u => u.user.id === userId);
      return {
        userId,
        userName: userInOrg?.user.name || 'Unknown User',
        department: userInOrg?.department?.name
      };
    });
  });
  
  // Table display columns
  displayedColumns: Signal<string[]> = computed(() => {
    return ['product', ...this.selectedUserIds()];
  });

  isLoadingUsers = computed(
    () => this.organizationStore.getUsersStatus().isLoading
  );
  usersError = computed(() => this.organizationStore.getUsersStatus().error);
  hasUsers = computed(() => this.organizationStore.users().length > 0);

  constructor() {
    // Fetch user inventory when selected users change
    effect(() => {
      const selectedUsers = this.selectedUserIds();
      selectedUsers.forEach(userId => {
        if (userId !== 'WAREHOUSE') {
          // Check if inventory is already loaded to avoid infinite loop
          const inventory = this.inventoryStore.inventory();
          if (!inventory[userId] || inventory[userId].length === 0) {
            // Use setTimeout to avoid effect triggering during signal update
            setTimeout(() => {
              this.inventoryStore.fetchUserInventory(userId);
            });
          }
        }
      });
    });
  }

  ngOnInit() {
    // Fetch organization users for dropdown
    this.loadUsers();
    // Fetch warehouse inventory
    this.inventoryStore.fetchUserInventory('WAREHOUSE');
  }

  // Method to load/retry users
  loadUsers() {
    this.organizationService.getUsers();
  }

  // Add a user to the table
  addUser(userId: string) {
    const currentUsers = this.selectedUserIds();
    if (!currentUsers.includes(userId)) {
      this.selectedUserIds.set([...currentUsers, userId]);
    }
  }

  // Remove a user from the table
  removeUser(userId: string) {
    if (userId === 'WAREHOUSE') return; // Can't remove warehouse
    const currentUsers = this.selectedUserIds();
    this.selectedUserIds.set(currentUsers.filter(id => id !== userId));
  }

  // Show all users
  showAllUsers() {
    const allUserIds = ['WAREHOUSE', ...this.organizationStore.users().map(u => u.user.id)];
    this.selectedUserIds.set(allUserIds);
  }

  // Reset to warehouse only
  resetToWarehouse() {
    this.selectedUserIds.set(['WAREHOUSE']);
  }

  // Get available users not in the table
  getAvailableUsersForSelection(): UserAndUserInOrganization[] {
    const selectedUsers = this.selectedUserIds();
    return this.organizationStore.users().filter(u => !selectedUsers.includes(u.user.id));
  }

  // Get UPI tooltip for a cell
  getUpiTooltip(item: InventoryItem | null): string {
    if (!item || !item.upis || item.upis.length === 0) {
      return '';
    }
    return item.upis.join('\n');
  }

  // Check if a product row should have UPI styling
  shouldHighlightUpiRow(tableRow: TableData): boolean {
    return tableRow.hasUpi;
  }
}
