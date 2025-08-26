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
import {
  InventoryItem,
  Product,
  UserAndUserInOrganization,
} from '@equip-track/shared';
import { UserStore } from '../../../store/user.store';
import { UserDisplayComponent } from '../../shared/user-display/user-display.component';

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

interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

interface ProductColumnSort {
  productId: string | null;
  direction: 'asc' | 'desc';
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
    UserDisplayComponent,
  ],
  templateUrl: './inventory-by-users.component.html',
  styleUrls: ['./inventory-by-users.component.scss'],
})
export class InventoryByUsersComponent implements OnInit {
  inventoryStore = inject(InventoryStore);
  organizationStore = inject(OrganizationStore);
  organizationService = inject(OrganizationService);
  userStore = inject(UserStore);

  // Selected user IDs for columns
  selectedUserIds = signal<string[]>(['WAREHOUSE']);
  availableUsers = signal<UserAndUserInOrganization[]>([]);

  // Sorting state
  sortState = signal<SortState>({ column: 'product', direction: 'asc' });

  // Product-based column sorting state
  productColumnSort = signal<ProductColumnSort>({
    productId: null,
    direction: 'asc',
  });

  // Computed table data
  tableData: Signal<TableData[]> = computed(() => {
    const productsMap = this.organizationStore.productsMap();
    const selectedUsers = this.selectedUserIds();
    const sortState = this.sortState();

    // Get all products that have inventory in any selected user
    const productIds = new Set<string>();

    selectedUsers.forEach((userId) => {
      const userInventory = this.inventoryStore.getUserInventory(userId)();
      userInventory.forEach((item) => productIds.add(item.productId));
    });

    // Create table rows for each product
    const tableRows: TableData[] = [];

    productIds.forEach((productId) => {
      const product = productsMap.get(productId);
      if (!product) return;

      const userColumns: { [userId: string]: InventoryItem | null } = {};

      selectedUsers.forEach((userId) => {
        const userInventory = this.inventoryStore.getUserInventory(userId)();
        const item = userInventory.find((inv) => inv.productId === productId);
        userColumns[userId] = item || null;
      });

      tableRows.push({
        product,
        userColumns,
        hasUpi: product.hasUpi,
      });
    });

    // Apply sorting
    return this.applySorting(tableRows, sortState);
  });

  // User columns for table headers
  userColumns: Signal<UserColumn[]> = computed(() => {
    const selectedUsers = this.selectedUserIds();
    const productColumnSort = this.productColumnSort();

    // Create user column objects
    const userColumnObjects = selectedUsers.map((userId) => {
      if (userId === 'WAREHOUSE') {
        return {
          userId: 'WAREHOUSE',
          userName: 'Warehouse',
          department: undefined,
        };
      }

      const userInOrg = this.organizationStore.usersMap().get(userId);
      const departmentId = userInOrg?.userInOrganization.department?.id;
      const departmentName = this.userStore.getDepartmentName(
        departmentId ?? ''
      );
      return {
        userId,
        userName: userInOrg?.user.name || 'Unknown User',
        department: departmentName,
      };
    });

    // If product-based sorting is active, sort user columns by quantity for that product
    if (productColumnSort.productId) {
      const warehouseColumn = userColumnObjects.find(
        (col) => col.userId === 'WAREHOUSE'
      );
      const userColumnsToSort = userColumnObjects.filter(
        (col) => col.userId !== 'WAREHOUSE'
      );

      // Sort user columns by quantity for the selected product
      userColumnsToSort.sort((a, b) => {
        const aInventory = this.inventoryStore.getUserInventory(a.userId)();
        const bInventory = this.inventoryStore.getUserInventory(b.userId)();

        const aQuantity =
          aInventory.find(
            (item) => item.productId === productColumnSort.productId
          )?.quantity || 0;
        const bQuantity =
          bInventory.find(
            (item) => item.productId === productColumnSort.productId
          )?.quantity || 0;

        const comparison = aQuantity - bQuantity;
        return productColumnSort.direction === 'desc'
          ? -comparison
          : comparison;
      });

      // Return warehouse first, then sorted user columns
      return warehouseColumn
        ? [warehouseColumn, ...userColumnsToSort]
        : userColumnsToSort;
    }

    return userColumnObjects;
  });

  // Table display columns
  displayedColumns: Signal<string[]> = computed(() => {
    return ['product', ...this.userColumns().map((col) => col.userId)];
  });

  isLoadingUsers = computed(
    () => this.organizationStore.getUsersStatus().isLoading
  );
  usersError = computed(() => this.organizationStore.getUsersStatus().error);
  hasUsers = computed(() => this.organizationStore.users().length > 0);
  availableUsersForSelection: Signal<UserAndUserInOrganization[]> = computed(
    () => {
      const selectedUsers = this.selectedUserIds();
      return this.organizationStore
        .users()
        .filter((u) => !selectedUsers.includes(u.user.id));
    }
  );

  constructor() {
    // Fetch user inventory when selected users change
    effect(() => {
      const selectedUsers = this.selectedUserIds();
      selectedUsers.forEach((userId) => {
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
    this.selectedUserIds.set(currentUsers.filter((id) => id !== userId));
  }

  // Show all users
  showAllUsers() {
    const allUserIds = [
      'WAREHOUSE',
      ...this.organizationStore.users().map((u) => u.user.id),
    ];
    this.selectedUserIds.set(allUserIds);
  }

  // Reset to warehouse only
  resetToWarehouse() {
    this.selectedUserIds.set(['WAREHOUSE']);
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

  // Apply sorting to table data
  private applySorting(
    tableRows: TableData[],
    sortState: SortState
  ): TableData[] {
    return tableRows.sort((a, b) => {
      let comparison = 0;

      if (sortState.column === 'product') {
        comparison = a.product.name.localeCompare(b.product.name);
      } else {
        // Sorting by user column
        const aQuantity = a.userColumns[sortState.column]?.quantity || 0;
        const bQuantity = b.userColumns[sortState.column]?.quantity || 0;
        comparison = aQuantity - bQuantity;
      }

      return sortState.direction === 'desc' ? -comparison : comparison;
    });
  }

  // Handle header click for sorting
  onHeaderClick(column: string) {
    const currentSort = this.sortState();

    if (currentSort.column === column) {
      // Same column - toggle direction
      this.sortState.set({
        column,
        direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      // Different column - start with ascending
      this.sortState.set({
        column,
        direction: 'asc',
      });
    }
  }

  // Get sort icon for header
  getSortIcon(column: string): string {
    const currentSort = this.sortState();
    if (currentSort.column !== column) {
      return 'unfold_more'; // Default sort icon
    }
    return currentSort.direction === 'asc'
      ? 'keyboard_arrow_up'
      : 'keyboard_arrow_down';
  }

  // Check if column is currently sorted
  isColumnSorted(column: string): boolean {
    return this.sortState().column === column;
  }

  // Handle product cell click for column sorting
  onProductClick(productId: string) {
    const currentSort = this.productColumnSort();

    if (currentSort.productId === productId) {
      // Same product - toggle direction
      this.productColumnSort.set({
        productId,
        direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      // Different product - start with descending (most items first)
      this.productColumnSort.set({
        productId,
        direction: 'desc',
      });
    }
  }

  // Clear product-based column sorting
  clearProductColumnSort() {
    this.productColumnSort.set({ productId: null, direction: 'asc' });
  }

  // Check if product is currently sorting columns
  isProductSortingColumns(productId: string): boolean {
    return this.productColumnSort().productId === productId;
  }

  // Get indicator for product-based column sorting
  getProductSortIndicator(productId: string): string {
    const currentSort = this.productColumnSort();
    if (currentSort.productId !== productId) {
      return '';
    }
    return currentSort.direction === 'asc' ? '↑' : '↓';
  }
}
