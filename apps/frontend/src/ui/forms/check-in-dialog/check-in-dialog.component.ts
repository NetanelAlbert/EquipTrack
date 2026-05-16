import { Component, Inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryItem, InventoryForm, getOutstandingItems } from '@equip-track/shared';
import { EditableInventoryComponent } from '../../inventory/edit/editable-inventory.component';
import { SignaturePadComponent } from '../../signature-pad/signature-pad.component';
import { NotificationService } from '../../../services/notification.service';

export interface CheckInDialogData {
  form: InventoryForm;
}

export interface CheckInDialogResult {
  items: InventoryItem[];
  signature: string;
}

@Component({
  selector: 'app-check-in-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    TranslateModule,
    EditableInventoryComponent,
    SignaturePadComponent,
  ],
  templateUrl: './check-in-dialog.component.html',
  styleUrls: ['./check-in-dialog.component.scss'],
})
export class CheckInDialogComponent {
  readonly outstandingItems: InventoryItem[];
  readonly signature = signal('');

  readonly submitButton = {
    text: 'forms.check-in-dialog.submit',
    icon: 'check',
    color: 'primary',
  };

  constructor(
    public dialogRef: MatDialogRef<CheckInDialogComponent, CheckInDialogResult | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: CheckInDialogData,
    private notificationService: NotificationService
  ) {
    this.outstandingItems = getOutstandingItems(data.form);
  }

  onSignatureChange(sig: string): void {
    this.signature.set(sig);
  }

  onItemsSubmitted(items: InventoryItem[]): void {
    if (!this.signature()) {
      this.notificationService.showError('errors.forms.signature-required', 'Signature is required');
      return;
    }
    this.dialogRef.close({ items, signature: this.signature() });
  }

  onCancel(): void {
    this.dialogRef.close(undefined);
  }
}
