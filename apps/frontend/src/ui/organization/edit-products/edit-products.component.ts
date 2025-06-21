import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidatorFn,
} from '@angular/forms';
import { OrganizationStore } from '../../../store/organization.store';
import { Product } from '@equip-track/shared';
import { TranslateModule } from '@ngx-translate/core';

interface ProductFormGroup extends FormGroup {
  controls: {
    id: FormGroup['controls']['id'];
    name: FormGroup['controls']['name'];
    upi: FormGroup['controls']['upi'];
  };
}

// TODO: move to shared together with edit-inventory.component.ts validator
// TODO: make it actually work
const duplicateIdValidator: ValidatorFn = (formArray: AbstractControl) => {
  if (!(formArray instanceof FormArray)) {
    return null;
  }
  const items = formArray.value;
  const ids = new Set<string>();
  const duplicates = new Set<string>();

  items.forEach((item: any) => {
    const id = item.id;
    if (id) {
      if (ids.has(id)) {
        duplicates.add(id);
      } else {
        ids.add(id);
      }
    }
  });

  return duplicates.size > 0 ? { duplicateIds: Array.from(duplicates) } : null;
};

@Component({
  selector: 'app-edit-products',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    ReactiveFormsModule,
    TranslateModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './edit-products.component.html',
  styleUrls: ['./edit-products.component.scss'],
})
export class EditProductsComponent {
  private fb = inject(FormBuilder);
  private organizationStore = inject(OrganizationStore);

  products = this.organizationStore.products;
  updatingProducts = this.organizationStore.updatingProducts;
  errorUpdatingProducts = this.organizationStore.errorUpdatingProducts;
  form: FormGroup = this.fb.group({
    products: this.fb.array<ProductFormGroup>([], [duplicateIdValidator]),
  });

  constructor() {
    this.initializeForm();
  }

  private initializeForm() {
    const productsArray = this.fb.array<ProductFormGroup>([]);
    this.products().forEach((product) => {
      productsArray.push(this.createProductFormGroup(product));
    });
    this.form.setControl('products', productsArray);
  }

  private createProductFormGroup(product: Product): ProductFormGroup {
    return this.fb.group({
      id: [product.id, [Validators.required]],
      name: [product.name, [Validators.required, Validators.minLength(2)]],
      upi: [product.hasUpi],
    }) as ProductFormGroup;
  }

  get productsArray() {
    return this.form.get('products') as FormArray<ProductFormGroup>;
  }

  addProduct() {
    const newProduct: Product = {
      id: '',
      name: '',
      hasUpi: false,
    };
    this.productsArray.push(this.createProductFormGroup(newProduct));
  }

  removeProduct(index: number) {
    this.productsArray.removeAt(index);
    this.productsArray.updateValueAndValidity();
  }

  save() {
    if (this.form.valid) {
      const updatedProducts = this.productsArray.value;
      // NOTE: errors are handled in the store
      void this.organizationStore.editProducts(updatedProducts);
    } else {
      this.form.markAllAsTouched();
    }
  }
}
