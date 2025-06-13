import {
  Component,
  effect,
  inject,
  input,
  output,
  Signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InventoryItem, Product } from '@equip-track/shared';
import { OrganizationStore } from '../../../store';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  AbstractControl,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  FormInventoryItem,
  FormInventoryItemMapper,
  FormInventoryItemMapperFromItem,
  emptyItem,
} from './form.mudels';
import { TranslateModule } from '@ngx-translate/core';
import { EditableItemComponent } from './item/editable-item.component';
import { debounceTime, distinctUntilChanged } from 'rxjs';

const formDuplicateValidator: ValidatorFn = (formArray: AbstractControl) => {
  if (!(formArray instanceof FormArray)) {
    return null;
  }
  const items = formArray.controls.map((item) => item.value);
  const productIDs = new Set<string>();
  const duplicateProductNames = new Set<string>();
  items.forEach((item) => {
    if (productIDs.has(item.product?.id ?? '')) {
      duplicateProductNames.add(item.product?.name ?? '');
    } else {
      productIDs.add(item.product?.id ?? '');
    }
  });
  return duplicateProductNames.size > 0
    ? { duplicate: [...duplicateProductNames] }
    : null;
};
@Component({
  selector: 'editable-inventory',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
    EditableItemComponent,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
  ],
  templateUrl: './editable-inventory.component.html',
  styleUrl: './editable-inventory.component.scss',
})
export class EditableInventoryComponent {
  originalItems = input<InventoryItem[]>([]);
  editedItems = output<InventoryItem[]>();
  submitItems = output<InventoryItem[]>();
  organizationStore = inject(OrganizationStore);
  products: Signal<Product[]> = this.organizationStore.products;
  fb = inject(FormBuilder);
  form: FormGroup = this.fb.group({
    items: this.fb.array<FormGroup<FormInventoryItem>>(
      [],
      [Validators.minLength(1), formDuplicateValidator]
    ),
  });
  formChanged = false;

  constructor() {
    this.form.valueChanges.subscribe(() => {
      this.formChanged = true;
    });
    this.form.valueChanges
      .pipe(debounceTime(100), distinctUntilChanged())
      .subscribe(() => {
        this.editedItems.emit(this.getItems());
      });
    this.setEffects();
  }

  get items(): FormArray<FormGroup<FormInventoryItem>> {
    return this.form.controls['items'] as FormArray;
  }

  addItem(item?: InventoryItem) {
    const product = item
      ? this.organizationStore.getProduct(item.productID) ?? null
      : null;
    const formItem = item
      ? FormInventoryItemMapperFromItem(this.fb, item, product)
      : emptyItem(this.fb);
    this.items.push(formItem, { emitEvent: false });
  }

  removeItem(index: number) {
    this.items.removeAt(index);
    this.items.updateValueAndValidity();
  }

  save() {
    this.formChanged = false;
    if (this.form.valid) {
      const items = this.getItems();
      this.submitItems.emit(items);
    } else {
      this.form.markAllAsTouched();
    }
  }

  private getItems(): InventoryItem[] {
    return this.items.controls.map((item: FormGroup<FormInventoryItem>) =>
      FormInventoryItemMapper(item.controls)
    );
  }

  private resetItems() {
    this.items.clear({ emitEvent: false });
    this.originalItems().forEach((item) => this.addItem(item));

    if (this.items.length === 0) {
      this.addItem();
    }
  }

  private setEffects() {
    effect(() => {
      this.resetItems();
    });
  }
}
