import {
  Component,
  effect,
  inject,
  input,
  Signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Product } from '@equip-track/shared';
import { MatSelectModule } from '@angular/material/select';
import { OrganizationStore } from '../../../../store';
import { FormInventoryItem } from '../form.mudels';

@Component({
  selector: 'editable-item',
  standalone: true,
  imports: [CommonModule, MatSelectModule, ReactiveFormsModule],
  templateUrl: './editable-item.component.html',
  styleUrl: './editable-item.component.scss',
})
export class EditableItemComponent {
  control = input<FormGroup<FormInventoryItem>>();

  organizationStore = inject(OrganizationStore);
  products: Signal<Product[]> = this.organizationStore.products;

  constructor() {
    this.initialResizeUPIs();
  }

  private initialResizeUPIs() {
    effect(() => {
      const quantityControl = this.control()?.controls['quantity'];
      const upisControl = this.control()?.controls['upis'];
      if (!quantityControl || !upisControl) {
        console.error(
          'EditableItemComponent: missing quantity or upis control'
        );
        return;
      }
      quantityControl.valueChanges.subscribe((value) => {
        if (!value) return;

        if (value < 0) {
          quantityControl.setValue(0);
          return;
        }

        while (upisControl.length < value) {
          upisControl.push(new FormControl(''));
        }

        while (upisControl.length > value) {
          upisControl.removeAt(upisControl.length - 1);
        }
      });
    });
  }
}
