import {
  Component,
  computed,
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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EditableItemComponent } from './item/editable-item.component';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Inject } from '@angular/core';
import { isSubset } from '@equip-track/shared';

const formDuplicateValidator: ValidatorFn = (formArray: AbstractControl) => {
  if (!(formArray instanceof FormArray)) {
    return null;
  }
  const items = formArray.controls.map((item) => item.value);
  const productIDs = new Set<string>();
  const duplicateProductNames = new Set<string>();
  const duplicateProductIds = new Set<number>();
  items.forEach((item) => {
    if (productIDs.has(item.product?.id ?? '')) {
      duplicateProductNames.add(item.product?.name ?? '');
      duplicateProductIds.add(item.product?.id ?? 0);
    } else {
      productIDs.add(item.product?.id ?? '');
    }
  });
  // side effect to manually set / unset the duplicate error for each item

  formArray.controls.forEach((item) => {
    const productId = item.value.product?.id ?? '';
    if (duplicateProductIds.has(productId)) {
      item.setErrors({ duplicate: true });
    } else {
      const errors = item.errors;
      if (errors && 'duplicate' in errors) {
        delete errors['duplicate'];
        item.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
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
    MatDialogModule,
    TranslateModule,
  ],
  templateUrl: './editable-inventory.component.html',
  styleUrl: './editable-inventory.component.scss',
})
export class EditableInventoryComponent {
  originalItems = input<InventoryItem[]>([]);
  limitItems = input<InventoryItem[] | undefined>(undefined);
  submitButton = input<{ text: string; icon: string; color: string }>({
    text: 'inventory.button.save',
    icon: 'save',
    color: 'accent',
  });
  editedItems = output<InventoryItem[]>();
  submitItems = output<InventoryItem[]>();
  organizationStore = inject(OrganizationStore);
  products: Signal<Product[]> = this.organizationStore.products;
  fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private translateService = inject(TranslateService);
  form: FormGroup = this.fb.group({
    items: this.fb.array<FormGroup<FormInventoryItem>>(
      [],
      [Validators.minLength(1), formDuplicateValidator]
    ),
  });
  formChanged = false;

  private limitItemsMap: Signal<Record<string, InventoryItem> | undefined> =
    computed(() =>
      this.limitItems()?.reduce((acc, item) => {
        acc[item.productId] = item;
        return acc;
      }, {} as Record<string, InventoryItem>)
    );

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
      ? this.organizationStore.getProduct(item.productId) ?? null
      : null;
    const formItem = item
      ? FormInventoryItemMapperFromItem(
          this.fb,
          item,
          product,
          this.limitValidator
        )
      : emptyItem(this.fb, this.limitValidator);
    this.items.push(formItem, { emitEvent: false });
  }

  removeItem(index: number) {
    const itemControl = this.items.at(index);
    const productName =
      itemControl?.get('product')?.value?.name || 'Unknown Product';

    // Create a simple confirmation dialog
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: {
        title: this.translateService.instant('inventory.remove-item'),
        message: this.translateService.instant(
          'inventory.form.confirm-remove',
          { product: productName }
        ),
        confirmText: this.translateService.instant('common.delete'),
        cancelText: this.translateService.instant('common.cancel'),
      },
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.items.removeAt(index);
        this.items.updateValueAndValidity();
      }
    });
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
    effect(() => {
      console.log('limitItemsMap', this.limitItemsMap());
    });
    effect(() => {
      console.log('limitItems', this.limitItems());
    });
  }

  private limitValidator: ValidatorFn = (item: AbstractControl) => {
    if (!(item instanceof FormGroup)) {
      console.error('limitValidator: item is not a FormGroup');
      return null;
    }
    const productId = item.value.product?.id ?? '';
    // product not chosen
    if (!productId) {
      return null;
    }
    // no limit items
    if (!this.limitItemsMap()) {
      return null;
    }
    // product not found in limit items
    const limitItem = this.limitItemsMap()?.[productId];
    if (!limitItem) {
      return { notFound: true };
    }
    // quantity exceeds limit
    const quantity = item.value.quantity ?? 0;
    if (quantity > limitItem.quantity) {
      return { limit: limitItem.quantity };
    }
    // if product is not UPI, skip upis validation
    if (!this.organizationStore.isProductUpi(productId)) {
      return null;
    }
    // upis not subset of limit upis
    const upisArray = (item.value.upis ?? []).filter(Boolean) as string[];
    const upis = new Set(upisArray);
    const limitUpis = new Set(limitItem.upis ?? []);
    if (!isSubset(upis, limitUpis)) {
      const missingUpis = Array.from(upis).filter((upi) => !limitUpis.has(upi));
      return { missingUpis };
    }
    return null;
  };
}

@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        {{ data.cancelText }}
      </button>
      <button mat-raised-button color="warn" (click)="onConfirm()">
        {{ data.confirmText }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 300px;
        padding: 20px 0;
      }
    `,
  ],
})
export class ConfirmDeleteDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDeleteDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      title: string;
      message: string;
      confirmText: string;
      cancelText: string;
    }
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
