import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryListComponent } from '../../inventory/list/inventory-list.component';
import { InventoryForm } from '@equip-track/shared';
import { SignaturePadComponent } from '../../signature-pad/signature-pad.component';
import { MatDialog } from '@angular/material/dialog';
import { RejectFormDialogComponent } from '../reject-form-dialog/reject-form-dialog.component';
import { SignatureDialogComponent } from '../signature-dialog/signature-dialog.component';

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

  constructor(private dialog: MatDialog) {}

  onApprove() {
    const dialogRef = this.dialog.open(SignatureDialogComponent, {
      data: { signature: '' },
    });

    dialogRef.afterClosed().subscribe((signature: string | undefined) => {
      if (signature) {
        console.log(
          'Form approved with signature.',
          'signature size',
          signature.length,
          'for form:',
          this.form.formID
        );
        // TODO: Implement form approval logic
      }
    });
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
