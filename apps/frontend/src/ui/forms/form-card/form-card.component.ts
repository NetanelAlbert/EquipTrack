import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryListComponent } from '../../inventory/list/inventory-list.component';
import { InventoryForm } from '@equip-track/shared';
import { SignaturePadComponent } from '../../signature-pad/signature-pad.component';
import { MatDialog } from '@angular/material/dialog';
import { RejectFormDialogComponent } from '../reject-form-dialog/reject-form-dialog.component';
import { SignatureDialogComponent } from '../signature-dialog/signature-dialog.component';
import { UserStore } from '../../../store/user.store';
import { UserRole, FormStatus, FormType } from '@equip-track/shared';

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

  dialog = inject(MatDialog);
  userStore = inject(UserStore);

  get isAdminOrWarehouseManager(): boolean {
    const role = this.userStore.activeOrganization.role();
    return role === UserRole.Admin || role === UserRole.WarehouseManager;
  }

  get showCheckInButton(): boolean {
    return (
      this.isAdminOrWarehouseManager &&
      this.form.status === FormStatus.Approved &&
      this.form.type === FormType.CheckOut
    );
  }

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

  onCheckIn() {
    // TODO: Implement check-in logic for returning items
    console.log('Check in clicked for form:', this.form.formID);
  }
}
