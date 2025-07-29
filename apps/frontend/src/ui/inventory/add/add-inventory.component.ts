import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InventoryItem } from '@equip-track/shared';
import { InventoryStore } from '../../../store';
import { EditableInventoryComponent } from '../edit/editable-inventory.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NotificationService } from '../../../services/notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-add-inventory',
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
  templateUrl: './add-inventory.component.html',
  styleUrl: './add-inventory.component.scss',
})
export class AddInventoryComponent {
  inventoryStore = inject(InventoryStore);
  private notificationService = inject(NotificationService);
  private translateService = inject(TranslateService);
  private router = inject(Router);
  submitButton = { text: 'inventory.button.add-items', icon: 'save', color: 'accent' };

  async onSubmitItems(items: InventoryItem[]) {
    if (items.length === 0) {
      this.notificationService.showError(
        'inventory.add.error.no-items',
        'Please add at least one item before saving'
      );
      return;
    }

    const success = await this.inventoryStore.addInventory(items);

    if (success) {
      // Success notification is now handled by the store
      this.goBack();
    }
    // Error notifications are also handled by the store
  }

  clearError() {
    this.inventoryStore.clearAddInventoryError();
  }

  goBack() {
    this.router.navigate(['/all-inventory']);
  }
}
