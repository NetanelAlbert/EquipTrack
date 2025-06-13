import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryListComponent } from '../../inventory/list/inventory-list.component';
import { InventoryForm } from '@equip-track/shared';
import { SignaturePadComponent } from '../../signature-pad/signature-pad.component';
import { MatDialog } from '@angular/material/dialog';
import { RejectFormDialogComponent } from '../reject-form-dialog/reject-form-dialog.component';

@Component({
  selector: 'app-form-card',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    TranslateModule,
    InventoryListComponent,
    SignaturePadComponent,
  ],
  templateUrl: './form-card.component.html',
  styleUrls: ['./form-card.component.scss'],
})
export class FormCardComponent {
  @Input() form!: InventoryForm;

  signatureData = '';

  constructor(private dialog: MatDialog) {}

  onApprove() {
    console.log('form Approve', this.form.formID);
  }

  onReject() {
    const dialogRef = this.dialog.open(RejectFormDialogComponent, {
      data: { formId: this.form.formID },
    });

    dialogRef.afterClosed().subscribe((reason: string | undefined) => {
      if (reason) {
        console.log('Form rejected with reason:', reason);
        // TODO: Implement form rejection logic
      }
    });
  }
}
