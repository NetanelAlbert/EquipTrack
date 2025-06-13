import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryListComponent } from '../../inventory/list/inventory-list.component';
import { InventoryForm } from '@equip-track/shared';
import { SignaturePadComponent } from '../../signature-pad/signature-pad.component';

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

  onApprove() {
    console.log('form Approve', this.form.formID);
    
  }

  onReject() {
    console.log('form Reject', this.form.formID);
  }
}
