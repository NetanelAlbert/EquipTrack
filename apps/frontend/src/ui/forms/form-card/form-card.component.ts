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
import { OrganizationStore } from '../../../store/organization.store';
import { UI_DATE_TIME_FORMAT } from '@equip-track/shared';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationService } from '../../../services/notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-form-card',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    TranslateModule,
    InventoryListComponent,
    MatTooltipModule,
  ],
  templateUrl: './form-card.component.html',
  styleUrls: ['./form-card.component.scss'],
})
export class FormCardComponent {
  @Input({ required: true }) form!: InventoryForm;

  dateTimeFormat = UI_DATE_TIME_FORMAT;
  organizationStore = inject(OrganizationStore);

  private readonly dialog = inject(MatDialog);
  private readonly userStore = inject(UserStore);
  private readonly formsStore = inject(FormsStore);
  private readonly clipboard = inject(Clipboard);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

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

          await this.formsStore.approveForm(
            this.form.formID,
            this.form.userID,
            signature
          );
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

          await this.formsStore.rejectForm(
            this.form.formID,
            this.form.userID,
            reason
          );
        } catch (error) {
          console.error('Failed to reject form:', error);
        }
      }
    });
  }

  onCheckIn() {
    this.router.navigate(['/create-form'], {
      queryParams: {
        formType: FormType.CheckIn,
        userId: this.form.userID,
        items: JSON.stringify(this.form.items),
      },
    });
  }

  get userName(): string {
    const currentUser = this.userStore.user();
    if (currentUser?.id === this.form.userID) {
      return currentUser.name;
    }
    return this.organizationStore.getUserName(this.form.userID);
  }

  get pdfUri(): string | undefined {
    // todo: presigned url from backend and cache it
    return this.form.pdfUri;
  }

  onPrintForm() {
    this.formsStore
      .getPresignedUrl(
        this.form.formID,
        this.form.userID,
        this.userStore.selectedOrganizationId()
      )
      .then((url) => {
        if (url) {
          window.open(url, '_blank');
        }
      });
  }

  onCopyFormId() {
    this.clipboard.copy(this.form.formID);
    this.notificationService.showSuccess('forms.form-id-copied');
  }

  onCloneForm() {
    this.router.navigate(['/create-form'], {
      queryParams: {
        formType: this.form.type,
        items: JSON.stringify(this.form.items),
      },
    });
  }
}
