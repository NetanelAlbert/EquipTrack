import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserStore } from '../../store';
import { EditableInventoryComponent } from '../inventory/edit/editable-inventory.component';
import { InventoryItem } from '@equip-track/shared';
import { FormsStore } from '../../store/forms.store';

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
  submitButton = { text: 'inventory.button.create-check-in', icon: 'check', color: 'primary' };

  onEditedItems(items: InventoryItem[]) {
    // TODO: Implement check-in logic (maybe merge with check-out component)
    console.log('Edited items:', items);
    const userId = this.userStore.user()?.id;
    if (!userId) {
      console.error('User ID not available');
      return;
    }
    this.formsStore.addCheckInForm(items, userId);
  }
}
