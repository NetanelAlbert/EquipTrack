import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryListComponent } from '../../inventory/list/inventory-list.component';
import { InventoryForm } from '@equip-track/shared';

@Component({
  selector: 'app-form-card',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    TranslateModule,
    InventoryListComponent,
  ],
  template: `
    <div class="form-card">
      <h3>{{ 'forms.form-id' | translate }}: {{ form.formID }}</h3>
      <p>
        {{ 'forms.status' | translate }}:
        {{ 'forms.status-' + form.status | translate }}
      </p>
      <p>
        {{ 'forms.created-at' | translate }}:
        {{ form.createdAtTimestamp | date : 'MM/dd/yyyy HH:mm' }}
      </p>
      <inventory-list [inventoryItems]="form.items"></inventory-list>
    </div>
  `,
  styles: [
    `
      .form-card {
        padding: 16px;
        border-radius: 8px;
        background-color: var(--color-bg-primary);
        box-shadow: 0 2px 4px var(--color-shadow-light);
        border: 1px solid var(--color-border-light);
        transition: all 0.2s ease-in-out;

        &:hover {
          background-color: var(--color-bg-hover);
          box-shadow: 0 4px 8px var(--color-shadow-medium);
        }

        h3 {
          margin: 0 0 8px 0;
          font-size: 1.1rem;
          color: var(--color-accent);
        }

        p {
          margin: 0 0 16px 0;
          color: #e0e0e0;
          opacity: 0.8;
        }
      }
    `,
  ],
})
export class FormCardComponent {
  @Input() form!: InventoryForm;
}
