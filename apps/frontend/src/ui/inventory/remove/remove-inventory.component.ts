import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { InventoryItem } from '@equip-track/shared';
import { InventoryStore } from '../../../store';
import { EditableInventoryComponent } from '../edit/editable-inventory.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

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
export class RemoveInventoryComponent {
  inventoryStore = inject(InventoryStore);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);
  private router = inject(Router);

  async onSubmitItems(items: InventoryItem[]) {
    if (items.length === 0) {
      this.snackBar.open(
        this.translateService.instant('inventory.remove.error.no-items'),
        this.translateService.instant('common.close'),
        { duration: 3000 }
      );
      return;
    }

    const success = await this.inventoryStore.removeInventory(items);

    if (success) {
      this.snackBar.open(
        this.translateService.instant('inventory.remove.success', {
          count: items.length,
        }),
        this.translateService.instant('common.close'),
        { duration: 3000 }
      );
      this.goBack();
    }
  }

  clearError() {
    this.inventoryStore.clearRemoveInventoryError();
  }

  goBack() {
    this.router.navigate(['/all-inventory']);
  }
}
