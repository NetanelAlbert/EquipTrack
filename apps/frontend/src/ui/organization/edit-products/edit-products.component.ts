import { Component, computed, inject, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
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
import { AbstractControl, ValidatorFn } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatDialog } from '@angular/material/dialog';
import { EditProductNameDialogComponent } from './edit-product-name-dialog.component';
import { CanComponentDeactivate } from '../../../app/guards/unsaved-changes.guard';

type upiFilterOptions = 'upi' | 'no-upi' | 'all';
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
    FormsModule,
    MatRadioModule,
  ],
  templateUrl: './edit-products.component.html',
  styleUrls: ['./edit-products.component.scss'],
})
export class EditProductsComponent implements CanComponentDeactivate {
  private fb = inject(FormBuilder);
  private organizationStore = inject(OrganizationStore);
  private organizationService = inject(OrganizationService);
  private dialog = inject(MatDialog);

  products = this.organizationStore.products;
  newProductForm: FormGroup = this.fb.group({
    id: ['', [Validators.required, this.duplicateIdValidator()]],
    name: ['', [Validators.required]],
    upi: [false],
  });
  searchTerm = model<string>('');
  upiFilter = model<upiFilterOptions>('all');
  filteredProducts = computed(() => {
    return this.products().filter((product) => {
      if (this.upiFilter() === 'upi' && !product.hasUpi) {
        return false;
      }
      if (this.upiFilter() === 'no-upi' && product.hasUpi) {
        return false;
      }
      const searchTerm = this.searchTerm().toLowerCase();
      if (!searchTerm) {
        return true;
      }
      return (
        product.name.toLowerCase().includes(searchTerm) ||
        product.id.toLowerCase().includes(searchTerm)
      );
    });
  });

  // Track loading states per product id
  productLoadingStates = new Map<
    string,
    { saving: boolean; deleting: boolean }
  >();

  async saveNewProduct() {
    if (!this.newProductForm.valid) {
      this.newProductForm.markAllAsTouched();
      return;
    }

    const formValue = this.newProductForm.value;
    if (!formValue.id || !formValue.name || formValue.upi === undefined) {
      console.error('Invalid product form value:', formValue);
      return;
    }

    const product: Product = {
      id: formValue.id,
      name: formValue.name,
      hasUpi: formValue.upi,
    };

    const success = await this.saveProduct(product);
    if (success) {
      this.newProductForm.reset();
    }
  }

  async editProductName(product: Product) {
    const dialogRef = this.dialog.open(EditProductNameDialogComponent, {
      data: { product },
      width: '500px',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe(async (newName: string) => {
      if (newName && newName.trim() !== product.name) {
        // Create a copy of the product with the new name
        const updatedProduct: Product = {
          ...product,
          name: newName.trim(),
        };
        await this.saveProduct(updatedProduct);
      }
    });
  }

  async saveProduct(product: Product): Promise<boolean> {
    const productId = product.id;
    const loadingState = this.productLoadingStates.get(productId) || {
      saving: false,
      deleting: false,
    };
    loadingState.saving = true;
    this.productLoadingStates.set(productId, loadingState);

    let success = false;
    try {
      success = await this.organizationService.saveProduct(product);
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
      this.productLoadingStates.set(productId, loadingState);
    }

    return success;
  }

  async removeProduct(productId: string) {
    // Set loading state for existing product deletion
    const loadingState = this.productLoadingStates.get(productId) || {
      saving: false,
      deleting: false,
    };
    loadingState.deleting = true;
    this.productLoadingStates.set(productId, loadingState);

    try {
      const success = await this.organizationService.deleteProduct(productId);
      if (success) {
        // Product was deleted successfully and store was updated by the service
        this.productLoadingStates.delete(productId);
        console.log('Product deleted successfully:', productId);
      } else {
        console.error('Failed to delete product:', productId);
        // Clear loading state on failure
        loadingState.deleting = false;
        this.productLoadingStates.set(productId, loadingState);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      // Clear loading state on error
      loadingState.deleting = false;
      this.productLoadingStates.set(productId, loadingState);
    }
  }

  get newProductId(): string {
    return this.newProductForm.get('id')?.value;
  }

  isProductSaving(productId: string): boolean {
    return this.productLoadingStates.get(productId)?.saving || false;
  }

  isProductDeleting(productId: string): boolean {
    return this.productLoadingStates.get(productId)?.deleting || false;
  }

  private duplicateIdValidator(): ValidatorFn {
    return (idControl: AbstractControl) => {
      const id = idControl.value;
      const existingIndexWithSameId = this.products().findIndex(
        (product) => product.id === id
      );

      return existingIndexWithSameId !== -1 ? { duplicateId: true } : null;
    };
  }

  hasUnsavedChanges(): boolean {
    return this.newProductForm.dirty;
  }
}
