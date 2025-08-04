import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InventoryItem } from '@equip-track/shared';
import { InventoryStore } from '../../../store';
import { EditableInventoryComponent } from '../edit/editable-inventory.component';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../../services/notification.service';
import { Router } from '@angular/router';
import { CanComponentDeactivate } from '../../../app/guards/unsaved-changes.guard';

@Component({
  selector: 'app-remove-inventory',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    EditableInventoryComponent,
  ],
  templateUrl: './remove-inventory.component.html',
  styleUrl: './remove-inventory.component.scss',
})
export class RemoveInventoryComponent implements CanComponentDeactivate {
  inventoryStore = inject(InventoryStore);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  submitButton = { text: 'inventory.button.remove-items', icon: 'delete', color: 'warn' };

  itemEdited = signal(false);

  async onSubmitItems(items: InventoryItem[]) {
    if (items.length === 0) {
      this.notificationService.showError(
        'inventory.remove.error.no-items',
        'Please add at least one item to remove'
      );
      return;
    }

    const success = await this.inventoryStore.removeInventory(items);

    if (success) {
      // Success notification is now handled by the store
      this.goBack();
    }
    // Error notifications are also handled by the store
  }

  clearError() {
    this.inventoryStore.clearRemoveInventoryError();
  }

  goBack() {
    this.router.navigate(['/all-inventory']);
  }

  hasUnsavedChanges(): boolean {
    return this.itemEdited();
  }
}
