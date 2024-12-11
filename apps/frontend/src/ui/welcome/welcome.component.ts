import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopBarComponent } from '..';
import { InventoryListComponent } from '..';
import { UserStore } from '../../store';
import { EditableInventoryComponent } from "../inventory/edit/editable-inventory.component";
@Component({
  selector: 'welcome',
  standalone: true,
  imports: [CommonModule, TopBarComponent, InventoryListComponent, EditableInventoryComponent],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {
  userStore = inject(UserStore);
}
