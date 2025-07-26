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
import { AbstractControl, ValidatorFn } from '@angular/forms';

type ProductFormGroup = FormGroup<{
  id: FormControl<string>;
  name: FormControl<string>;
  upi: FormControl<boolean>;
}>;

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
  form: FormGroup = this.fb.group({
    products: this.fb.array<ProductFormGroup>([]),
  });

  // Track loading states per product row
  productLoadingStates = new Map<
    number,
    { saving: boolean; deleting: boolean }
  >();

  constructor() {
    this.initializeForm();
  }

  private initializeForm() {
    const productsArray = this.fb.array<ProductFormGroup>([]);
    this.products().forEach((product, index) => {
      productsArray.push(this.createProductFormGroup(product, index));
      this.productLoadingStates.set(index, { saving: false, deleting: false });
    });
    this.form.setControl('products', productsArray);
  }

  private createProductFormGroup(
    product: Product,
    index: number
  ): ProductFormGroup {
    return this.fb.group({
      id: [product.id, [Validators.required, this.duplicateIdValidator(index)]],
      name: [product.name, [Validators.required, Validators.minLength(2)]],
      upi: [product.hasUpi],
    }) as ProductFormGroup;
  }

  get productsArray(): FormArray<ProductFormGroup> {
    return this.form.get('products') as FormArray<ProductFormGroup>;
  }

  addProduct() {
    const newProduct: Product = {
      id: '',
      name: '',
      hasUpi: false,
    };
    const newIndex = this.productsArray.length;
    this.productsArray.push(this.createProductFormGroup(newProduct, newIndex));
    this.productLoadingStates.set(newIndex, { saving: false, deleting: false });
  }

  async saveProduct(index: number) {
    const productForm = this.productsArray.at(index);
    if (!productForm || productForm.invalid) {
      productForm?.markAllAsTouched();
      return;
    }

    // Set loading state
    const loadingState = this.productLoadingStates.get(index) || {
      saving: false,
      deleting: false,
    };
    loadingState.saving = true;
    this.productLoadingStates.set(index, loadingState);

    try {
      const formValue = productForm.value;
      if (!formValue.id || !formValue.name || formValue.upi === undefined) {
        console.error('Invalid product form value:', formValue);
        return;
      }
      const product: Product = {
        id: formValue.id,
        name: formValue.name,
        hasUpi: formValue.upi,
      };

      const success = await this.organizationService.saveProduct(product);
      if (success) {
        // Product was saved successfully and store was updated by the service
        console.log('Product saved successfully:', product.id);
      } else {
        console.error('Failed to save product:', product.id);
      }
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      // Clear loading state
      loadingState.saving = false;
      this.productLoadingStates.set(index, loadingState);
    }
  }

  async removeProduct(index: number) {
    const productForm = this.productsArray.at(index);
    if (!productForm) return;

    const productId = productForm.get('id')?.value;

    // If this is a new product (empty ID), just remove from form
    if (!productId || productId.trim() === '') {
      this.productsArray.removeAt(index);
      this.productLoadingStates.delete(index);
      // Reindex the remaining products
      this.reindexLoadingStates(index);
      return;
    }

    // Set loading state for existing product deletion
    const loadingState = this.productLoadingStates.get(index) || {
      saving: false,
      deleting: false,
    };
    loadingState.deleting = true;
    this.productLoadingStates.set(index, loadingState);

    try {
      const success = await this.organizationService.deleteProduct(productId);
      if (success) {
        // Product was deleted successfully and store was updated by the service
        this.productsArray.removeAt(index);
        this.productLoadingStates.delete(index);
        // Reindex the remaining products
        this.reindexLoadingStates(index);
        console.log('Product deleted successfully:', productId);
      } else {
        console.error('Failed to delete product:', productId);
        // Clear loading state on failure
        loadingState.deleting = false;
        this.productLoadingStates.set(index, loadingState);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      // Clear loading state on error
      loadingState.deleting = false;
      this.productLoadingStates.set(index, loadingState);
    }
  }

  private reindexLoadingStates(removedIndex: number) {
    const newStates = new Map<number, { saving: boolean; deleting: boolean }>();
    this.productLoadingStates.forEach((state, index) => {
      if (index < removedIndex) {
        newStates.set(index, state);
      } else if (index > removedIndex) {
        newStates.set(index - 1, state);
      }
    });
    this.productLoadingStates = newStates;
  }

  isProductSaving(index: number): boolean {
    return this.productLoadingStates.get(index)?.saving || false;
  }

  isProductDeleting(index: number): boolean {
    return this.productLoadingStates.get(index)?.deleting || false;
  }

  isProductFormValid(index: number): boolean {
    const productForm = this.productsArray.at(index);
    return productForm ? productForm.valid : false;
  }

  private duplicateIdValidator(index: number): ValidatorFn {
    return (idControl: AbstractControl) => {
      const id = idControl.value;
      const firstIndexWithSameId = this.productsArray.controls.findIndex(
        (ctrl) => {
          const ctrlId = ctrl.get('id')?.value;
          return ctrlId === id && ctrlId !== '';
        }
      );

      return firstIndexWithSameId !== index ? { duplicateId: true } : null;
    };
  }
}
