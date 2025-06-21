import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryListComponent } from '../list/inventory-list.component';
import { InventoryStore } from '../../../store/inventory.store';
import { OrganizationStore } from '../../../store/organization.store';

@Component({
  selector: 'inventory-by-users',
  standalone: true,
  imports: [
    CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
    TranslateModule,
    InventoryListComponent,
  ],
  templateUrl: './inventory-by-users.component.html',
  styleUrls: ['./inventory-by-users.component.scss'],
})
export class InventoryByUsersComponent implements OnInit {
  inventoryStore = inject(InventoryStore);
  organizationStore = inject(OrganizationStore);
  selectedUserID = undefined;

  userItems = computed(() =>
    this.inventoryStore.getUserInventory(this.selectedUserID || '')
  );

  ngOnInit() {
    this.inventoryStore.fetchInventory();
  }

  onUserChange() {
    this.userItems = computed(() =>
      this.inventoryStore.getUserInventory(this.selectedUserID || '')
    );
  }
}
