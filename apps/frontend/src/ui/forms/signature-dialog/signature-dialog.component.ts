import { Component, Inject, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { SignaturePadComponent } from '../../signature-pad/signature-pad.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-signature-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    SignaturePadComponent,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'common.signature.title' | translate }}</h2>
    <mat-dialog-content>
      <app-signature-pad
        [width]="300"
        [height]="200"
        [backgroundColor]="'white'"
        [penColor]="'black'"
        (signatureChange)="onSignatureChange($event)"
        #sigPad
      ></app-signature-pad>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        {{ 'common.cancel' | translate }}
      </button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="!signatureData"
        (click)="onOk()"
      >
        {{ 'common.ok' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 320px;
      }

      @media (max-width: 600px) {
        .mat-mdc-dialog-content {
          padding: 0 2px;
        }
      }
    `,
  ],
})
export class SignatureDialogComponent implements AfterViewInit {
  signatureData = '';
  @ViewChild('sigPad') sigPad?: SignaturePadComponent;

  constructor(
    public dialogRef: MatDialogRef<SignatureDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { signature?: string }
  ) {
    if (data?.signature) {
      this.signatureData = data.signature;
    }
  }

  ngAfterViewInit() {
    if (this.data?.signature && this.sigPad) {
      this.sigPad.setSignatureData(this.data.signature);
    }
  }

  onSignatureChange(data: string) {
    this.signatureData = data;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onOk(): void {
    this.dialogRef.close(this.signatureData);
  }
}
