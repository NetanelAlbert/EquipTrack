import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslateModule } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Product } from '@equip-track/shared';
import { OrganizationStore } from '../../../store/organization.store';
import { OrganizationService } from '../../../services/organization.service';
import { FormControl } from '@angular/forms';

interface ProductForm {
  id: string;
  name: string;
  upi: boolean;
}

type ProductFormGroup = FormGroup<{
  id: FormControl<string>;
  name: FormControl<string>;
  upi: FormControl<boolean>;
}>;

import { AbstractControl, ValidatorFn } from '@angular/forms';

function duplicateIdValidator(): ValidatorFn {
  return (control: AbstractControl) => {
    if (!(control instanceof FormArray)) {
      return null;
    }
    const ids = control.controls.map((ctrl) => ctrl.get('id')?.value);
    const duplicates = ids.filter(
      (id, index) => ids.indexOf(id) !== index && id !== ''
    );
    return duplicates.length > 0 ? { duplicateIds: duplicates } : null;
  };
}

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
  private organizationService = inject(OrganizationService);

  products = this.organizationStore.products;
  updatingProducts = this.organizationStore.updatingProducts;
  errorUpdatingProducts = this.organizationStore.errorUpdatingProducts;
  form: FormGroup = this.fb.group({
    products: this.fb.array<ProductFormGroup>([], [duplicateIdValidator()]),
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
      const updatedProducts: Product[] = this.productsArray.value.map(
        (formValue: any) => ({
          id: formValue.id,
          name: formValue.name,
          hasUpi: formValue.upi,
        })
      );
      // Use service instead of store method
      void this.organizationService.editProducts(updatedProducts);
    } else {
      this.form.markAllAsTouched();
    }
  }
}
