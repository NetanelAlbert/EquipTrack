import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-reject-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'forms.reject-dialog.title' | translate }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ 'forms.reject-dialog.reason' | translate }}</mat-label>
        <textarea
          matInput
          [(ngModel)]="reason"
          rows="4"
          required
          [placeholder]="'forms.reject-dialog.reason-placeholder' | translate"
        ></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        {{ 'forms.reject-dialog.cancel' | translate }}
      </button>
      <button
        mat-raised-button
        color="warn"
        [disabled]="!reason"
        (click)="onConfirm()"
      >
        {{ 'forms.reject-dialog.confirm' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      mat-dialog-content {
        min-width: 300px;
      }
    `,
  ],
})
export class RejectFormDialogComponent {
  reason = '';

  constructor(
    public dialogRef: MatDialogRef<RejectFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { formId: string }
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    this.dialogRef.close(this.reason);
  }
}
