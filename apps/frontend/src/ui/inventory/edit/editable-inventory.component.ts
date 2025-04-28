import {
  Component,
  inject,
  input,
  OnInit,
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
} from '@angular/forms';
import { EditableItemComponent } from './item/editable-item.component';
import {
  FormInventoryItem,
  FormInventoryItemMapper,
  FormInventoryItemMapperFromItem,
  emptyItem,
} from './form.mudels';
import { TranslateModule } from '@ngx-translate/core';

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
export class EditableInventoryComponent implements OnInit {
  originalItems = input<InventoryItem[]>([]);
  editedItems = output<InventoryItem[]>();
  organizationStore = inject(OrganizationStore);
  products: Signal<Product[]> = this.organizationStore.products;
  fb = inject(FormBuilder);
  form: FormGroup = this.fb.group({
    // TODO - add form validation
    items: this.fb.array<FormGroup<FormInventoryItem>>([]),
  });
  formChanged = false;

  constructor() {
    this.form.valueChanges.subscribe(() => {
      this.formChanged = true;
    });
  }

  ngOnInit(): void {
    this.originalItems().forEach((item) => this.addItem(item));

    if (this.items.length === 0) {
      this.addItem();
    }
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
    this.items.push(formItem);
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }

  save() {
    this.formChanged = false;
    if (this.form.valid) {
      const items = this.items.controls.map(
        (item: FormGroup<FormInventoryItem>) => {
          console.log('save; item', item);
          return FormInventoryItemMapper(item.controls);
        }
      );
      console.log('save; items', items);
      this.editedItems.emit(items);
    } else {
      this.form.markAllAsTouched();
    }
  }
}
