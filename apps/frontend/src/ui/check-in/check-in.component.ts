import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserStore } from '../../store';
import { EditableInventoryComponent } from '../inventory/edit/editable-inventory.component';
import { InventoryItem } from '@equip-track/shared';
import { FormsStore } from '../../store';

@Component({
  selector: 'app-check-in',
  standalone: true,
  imports: [CommonModule, EditableInventoryComponent],
  templateUrl: './check-in.component.html',
  styleUrl: './check-in.component.scss',
})
export class CheckInComponent {
  userStore = inject(UserStore);
  formsStore = inject(FormsStore);

  onEditedItems(items: InventoryItem[]) {
    // TODO: Implement check-in logic
    console.log('Edited items:', items);
    this.formsStore.addCheckInForm(items);
  }
}
