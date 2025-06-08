import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryListComponent } from "../inventory/list/inventory-list.component";
import { UserStore } from '../../store';

@Component({
  selector: 'app-my-items',
  standalone: true,
  imports: [CommonModule, InventoryListComponent],
  templateUrl: './my-items.component.html',
  styleUrl: './my-items.component.scss',
})
export class MyItemsComponent {
  userStore = inject(UserStore);
  
}
