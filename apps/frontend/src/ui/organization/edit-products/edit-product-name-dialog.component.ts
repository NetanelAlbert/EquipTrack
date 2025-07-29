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
import { Product } from '@equip-track/shared';

@Component({
  selector: 'app-edit-product-name-dialog',
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
    <h2 mat-dialog-title>
      {{ 'organization.editProducts.editDialog.title' | translate }}
    </h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{
          'organization.editProducts.editDialog.currentName' | translate
        }}</mat-label>
        <input matInput [value]="data.product.name" readonly disabled />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{
          'organization.editProducts.editDialog.newName' | translate
        }}</mat-label>
        <input
          matInput
          [(ngModel)]="newName"
          name="newProductName"
          required
          [placeholder]="data.product.name"
          #nameInput
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        {{ 'organization.editProducts.editDialog.cancel' | translate }}
      </button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="
          !newName ||
          newName.trim() === '' ||
          newName.trim() === data.product.name
        "
        (click)="onSave()"
      >
        {{ 'organization.editProducts.editDialog.save' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
        margin-bottom: 16px;
      }
      mat-dialog-content {
        min-width: 400px;
        padding: 20px 0;
      }
      mat-form-field:last-of-type {
        margin-bottom: 0;
      }
    `,
  ],
})
export class EditProductNameDialogComponent {
  newName = '';

  constructor(
    public dialogRef: MatDialogRef<EditProductNameDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { product: Product }
  ) {
    // Initialize with current name for easier editing
    this.newName = data.product.name;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    const trimmedName = this.newName.trim();
    if (trimmedName && trimmedName !== this.data.product.name) {
      this.dialogRef.close(trimmedName);
    }
  }
}
