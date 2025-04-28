import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopBarComponent, EditableInventoryComponent, InventoryListComponent } from '..';
import { UserStore } from '../../store';
import { InventoryItem } from '@equip-track/shared';

@Component({
  selector: 'welcome',
  standalone: true,
  imports: [CommonModule, TopBarComponent, InventoryListComponent, EditableInventoryComponent],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {

onEditedItems(items: InventoryItem[]) {
  this.userStore.updateState(
    {
      checkedOut: items,
    }
  )
  this.editMode = false;
}
  userStore = inject(UserStore);
  editMode = false;
}
