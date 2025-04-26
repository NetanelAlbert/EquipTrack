import {
  Component,
  computed,
  effect,
  EventEmitter,
  HostBinding,
  inject,
  input,
  Output,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { Product } from '@equip-track/shared';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { OrganizationStore } from '../../../../store';
import { FormInventoryItem, emptyItem } from '../form.mudels';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'editable-item',
  standalone: true,
  imports: [
    CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './editable-item.component.html',
  styleUrl: './editable-item.component.scss',
})
export class EditableItemComponent {
  fb = inject(FormBuilder);
  organizationStore = inject(OrganizationStore);
  control = input<FormGroup<FormInventoryItem>>(emptyItem(this.fb));
  @Output() remove = new EventEmitter<void>();

  products: Signal<Product[]> = this.organizationStore.products;

  @HostBinding('class.upi-item') get isUpiItem() {
    return this.isUPI();
  }

  constructor() {
    this.initialResizeUPIs();
    this.initialIsUPI();
  }

  productControl: Signal<FormControl<Product | null>> = computed(
    () => this.control().controls['product']
  );
  quantityControl: Signal<FormControl<number | null>> = computed(
    () => this.control().controls['quantity']
  );
  upisControl: Signal<FormArray<FormControl<string | null>>> = computed(
    () => this.control().controls['upis']
  );
  isUPI: WritableSignal<boolean> = signal(false);

  private initialResizeUPIs() {
    effect(() => {
      const quantityControl = this.quantityControl();
      const upisControl = this.upisControl();
      if (!quantityControl || !upisControl) {
        console.error(
          'EditableItemComponent: missing quantity or upis control'
        );
        return;
      }
      quantityControl.valueChanges.subscribe((value) => {
        if (value === null) return;

        if (value < 0) {
          quantityControl.setValue(0, { emitEvent: false });
          value = 0;
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

  private initialIsUPI() {
    effect(() =>
      this.productControl().valueChanges.subscribe((value) =>
        this.isUPI.set(!!value?.upi)
      )
    );
  }
}
