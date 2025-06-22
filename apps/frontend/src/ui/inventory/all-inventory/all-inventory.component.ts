import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryListComponent } from '../list/inventory-list.component';
import { InventoryStore } from '../../../store/inventory.store';
import { OrganizationStore } from '../../../store/organization.store';

@Component({
  selector: 'all-inventory',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
    TranslateModule,
    InventoryListComponent,
  ],
  templateUrl: './all-inventory.component.html',
  styleUrls: ['./all-inventory.component.scss'],
})
export class AllInventoryComponent implements OnInit {
  inventoryStore = inject(InventoryStore);
  organizationStore = inject(OrganizationStore);

  warehouseItems = this.inventoryStore.wareHouseInventory;
  organizationItems = this.inventoryStore.totalOrganizationItems;

  ngOnInit() {
    this.inventoryStore.fetchInventory();
  }
}
