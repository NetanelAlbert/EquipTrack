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
import { MatButtonModule } from '@angular/material/button';
import { Product } from '@equip-track/shared';
import { OrganizationStore } from '../../../store';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
} from '@angular/forms';
import { EditableItemComponent } from "./item/editable-item.component";
import { FormInventoryItem, emptyItem } from './form.mudels';

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
    MatButtonModule
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
    items: this.fb.array<FormGroup<FormInventoryItem>>([]),
  });

  ngOnInit(): void {
    if (this.items.length === 0) {
      this.addItem();
    }
  }

  get items(): FormArray<FormGroup<FormInventoryItem>> {
    return this.form.controls['items'] as FormArray;
  }

  addItem() {
    this.items.push(emptyItem(this.fb));
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }

  save() {
    // TODO - implement save
    console.log(this.form.value);
  }
}
