import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { NotificationService } from '../../../services/notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-form-card',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
    InventoryListComponent,
    MatTooltipModule,
  ],
  templateUrl: './form-card.component.html',
  styleUrls: ['./form-card.component.scss'],
})
export class FormCardComponent {
  @Input({ required: true }) form!: InventoryForm;

  readonly isPrintPdfLoading = signal(false);

  dateTimeFormat = UI_DATE_TIME_FORMAT;
  organizationStore = inject(OrganizationStore);

  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
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

  onApprove() {
    const dialogRef = this.dialog.open(SignatureDialogComponent, {
      data: { signature: '' },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (signature: string | undefined) => {
        if (signature) {
          try {
            await this.formsStore.approveForm(
              this.form.formID,
              this.form.userID,
              signature
            );
          } catch (error) {
            console.error('Failed to approve form:', error);
            this.notificationService.handleApiError(
              error,
              'errors.forms.approve-failed'
            );
          }
        }
      });
  }

  onReject() {
    const dialogRef = this.dialog.open(RejectFormDialogComponent, {
      data: { formId: this.form.formID },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (reason: string | undefined) => {
        if (reason) {
          try {
            await this.formsStore.rejectForm(
              this.form.formID,
              this.form.userID,
              reason
            );
          } catch (error) {
            console.error('Failed to reject form:', error);
            this.notificationService.handleApiError(
              error,
              'errors.forms.reject-failed'
            );
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

  async onPrintForm(): Promise<void> {
    this.isPrintPdfLoading.set(true);
    try {
      const url = await this.formsStore.getPresignedUrl(
        this.form.formID,
        this.form.userID,
        this.userStore.selectedOrganizationId()
      );
      if (url) {
        window.open(url, '_blank');
      }
    } finally {
      this.isPrintPdfLoading.set(false);
    }
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
