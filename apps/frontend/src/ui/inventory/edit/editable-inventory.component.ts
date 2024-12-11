import {
  Component,
  inject,
  OnInit,
  Signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { InventoryItem, Product } from '@equip-track/shared';
import { OrganizationStore } from '../../../store';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
  FormControl,
} from '@angular/forms';

@Component({
  selector: 'editable-inventory',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './editable-inventory.component.html',
  styleUrl: './editable-inventory.component.scss',
})
export class EditableInventoryComponent implements OnInit {
  organizationStore = inject(OrganizationStore);
  products: Signal<Product[]> = this.organizationStore.products;
  fb = inject(FormBuilder);
  form: FormGroup = this.fb.group({
    // TODO - add form validation
    items: this.fb.array<FormControl<InventoryItem>>([]),
  });

  ngOnInit(): void {
    if (this.items.length === 0) {
      this.addItem();
    }
    this.print('ngOnInit');
  }

  print(when: string) {
    console.log('NA:: ', when, this.items.value);
  }

  private get emptyItem() {
    return this.fb.group({
      productID: ['', Validators.required],
      quantity: [0, Validators.required],
      upis: this.fb.array<string>(['', '']),
    });
  }

  get items(): FormArray {
    return this.form.controls['items'] as FormArray;
  }

  addItem() {
    this.items.push(this.emptyItem);
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }

  save() {
    // TODO - implement save
    console.log(this.form.value);
  }
}
