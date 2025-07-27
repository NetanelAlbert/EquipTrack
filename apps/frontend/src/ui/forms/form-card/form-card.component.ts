import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryListComponent } from '../../inventory/list/inventory-list.component';
import { InventoryForm } from '@equip-track/shared';
import { MatDialog } from '@angular/material/dialog';
import { RejectFormDialogComponent } from '../reject-form-dialog/reject-form-dialog.component';
import { SignatureDialogComponent } from '../signature-dialog/signature-dialog.component';
import { UserStore } from '../../../store/user.store';
import { FormsStore } from '../../../store/forms.store';
import { UserRole, FormStatus, FormType } from '@equip-track/shared';

@Component({
  selector: 'app-form-card',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    TranslateModule,
    InventoryListComponent,
  ],
  templateUrl: './form-card.component.html',
  styleUrls: ['./form-card.component.scss'],
})
export class FormCardComponent {
  @Input() form!: InventoryForm;

  dialog = inject(MatDialog);
  userStore = inject(UserStore);
  formsStore = inject(FormsStore);

  get isAdminOrWarehouseManager(): boolean {
    const role = this.userStore.currentRole();
    return role === UserRole.Admin || role === UserRole.WarehouseManager;
  }

  get showCheckInButton(): boolean {
    return (
      this.isAdminOrWarehouseManager &&
      this.form.status === FormStatus.Approved &&
      this.form.type === FormType.CheckOut
    );
  }

  async onApprove() {
    const dialogRef = this.dialog.open(SignatureDialogComponent, {
      data: { signature: '' },
    });

    dialogRef.afterClosed().subscribe(async (signature: string | undefined) => {
      if (signature) {
        try {
          console.log(
            'Form approved with signature.',
            'signature size',
            signature.length,
            'for form:',
            this.form.formID
          );

          await this.formsStore.approveForm(this.form.formID, signature);
        } catch (error) {
          console.error('Failed to approve form:', error);
          // TODO: Show error message to user via snackbar or toast
        }
      }
    });
  }

  async onReject() {
    const dialogRef = this.dialog.open(RejectFormDialogComponent, {
      data: { formId: this.form.formID },
    });

    dialogRef.afterClosed().subscribe(async (reason: string | undefined) => {
      if (reason) {
        try {
          console.log('Form rejected with reason:', reason);

          // ✅ Use real API through forms store
          await this.formsStore.rejectForm(this.form.formID, reason);
        } catch (error) {
          console.error('Failed to reject form:', error);
          // TODO: Show error message to user via snackbar or toast
        }
      }
    });
  }

  async onCheckIn() {
    try {
      console.log('Check in clicked for form:', this.form.formID);

      // ✅ Use real API through forms store to create check-in form
      await this.formsStore.addCheckInForm(this.form.items);

      console.log('Check-in form created for returned items');
    } catch (error) {
      console.error('Failed to create check-in form:', error);
      // TODO: Show error message to user via snackbar or toast
    }
  }
}
