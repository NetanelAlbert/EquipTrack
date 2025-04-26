import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { InventoryItem } from '@equip-track/shared';
import { OrganizationStore } from '../../../store';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'inventory-list',
  standalone: true,
  imports: [CommonModule, MatExpansionModule, MatListModule, TranslateModule],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.scss',
})
export class InventoryListComponent {
  inventoryItems = input<InventoryItem[]>();

  organizationStore = inject(OrganizationStore);
}
