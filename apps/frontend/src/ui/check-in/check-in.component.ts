import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserStore } from '../../store';
import { EditableInventoryComponent } from '../inventory/edit/editable-inventory.component';
import { InventoryItem } from '@equip-track/shared';
import { FormsStore } from '../../store/forms.store';
import { NotificationService } from '../../services/notification.service';

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
  notificationService = inject(NotificationService);

  async onEditedItems(items: InventoryItem[]) {
    // Validate that items are provided
    if (!items || items.length === 0) {
      this.notificationService.showError('Please select items to check in');
      return;
    }

    // Validate user is authenticated and has organization selected
    const user = this.userStore.user();
    const organizationId = this.userStore.selectedOrganizationId();
    
    if (!user) {
      this.notificationService.showError('User not authenticated');
      return;
    }

    if (!organizationId) {
      this.notificationService.showError('No organization selected');
      return;
    }

    try {
      console.log('Submitting check-in request for items:', items);
      
      // Submit check-in form through the forms store
      await this.formsStore.addCheckInForm(items);
      
      this.notificationService.showSuccess(
        `Check-in request submitted successfully for ${items.length} item(s). Awaiting approval.`
      );
      
      console.log('Check-in request submitted successfully');
    } catch (error) {
      console.error('Error submitting check-in request:', error);
      this.notificationService.showError(
        'Failed to submit check-in request. Please try again.'
      );
    }
  }
}
