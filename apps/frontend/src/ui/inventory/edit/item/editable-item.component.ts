import {
  Component,
  computed,
  effect,
  EventEmitter,
  HostBinding,
  inject,
  input,
  OnInit,
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
  ValidatorFn,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Product } from '@equip-track/shared';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { OrganizationStore } from '../../../../store';
import { FormInventoryItem, emptyItem } from '../form.mudels';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { first, map, distinctUntilChanged, filter } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'editable-item',
  standalone: true,
  imports: [
    CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './editable-item.component.html',
  styleUrl: './editable-item.component.scss',
})
export class EditableItemComponent implements OnInit {
  fb = inject(FormBuilder);
  organizationStore = inject(OrganizationStore);
  control = input<FormGroup<FormInventoryItem>>(emptyItem(this.fb, () => null));
  @Output() remove = new EventEmitter<void>();

  products: Signal<Product[]> = this.organizationStore.products;
  searchControl = new FormControl<string>('');
  searchTerm = signal<string>('');

  filteredProducts: Signal<Product[]> = computed(() => {
    const searchTerm = this.searchTerm();
    if (!searchTerm) {
      return this.products();
    }
    return this.products().filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.id.toLowerCase().includes(searchTerm)
    );
  });

  @HostBinding('class.upi-item') get isUpiItem() {
    return this.isUPI();
  }

  constructor() {
    this.initialResizeUPIs();
    this.initialIsUPI();
    this.initialSearchTerm();
  }

  onProductSelected(product: Product): void {
    this.productControl().setValue(product);
  }

  displayProduct(product: Product | null): string {
    return product ? `${product.name} (${product.id})` : '';
  }

  ngOnInit(): void {
    this.isUPI.set(this.productControl().value?.hasUpi ?? false);
    const currentProduct = this.productControl().value;
    if (currentProduct) {
      this.searchControl.setValue(this.displayProduct(currentProduct));
    }
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

  // Updated validation error signals
  productErrors: Signal<{ [key: string]: boolean }> = computed(() => {
    const control = this.productControl();
    return control.errors || {};
  });

  quantityErrors: Signal<{ [key: string]: boolean }> = computed(() => {
    const control = this.quantityControl();
    // Always return errors object, regardless of touched state for debugging
    return control.errors || {};
  });

  getUpiErrors(index: number): ValidationErrors {
    const control = this.upisControl().at(index);
    // Always return errors object, regardless of touched state for debugging
    return control.errors || {};
  }

  markAllAsTouched(): void {
    const form = this.control();
    form.markAllAsTouched();

    // Also mark all UPI controls as touched
    const upisArray = this.upisControl();
    upisArray.controls.forEach((control) => control.markAsTouched());
  }

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
          this.addUpi(false);
        }

        while (upisControl.length > value) {
          if (!this.removeEmptyUpi()) {
            break;
          }
        }

        if (upisControl.length > value) {
          quantityControl.setValue(upisControl.length, { emitEvent: false });
        }
      });

      upisControl.valueChanges
        .pipe(
          filter((value) => value !== null),
          map((value) => value.length),
          distinctUntilChanged()
        )
        .subscribe((length) => {
          if (length !== quantityControl.value) {
            quantityControl.setValue(length, { emitEvent: false });
          }
        });
    });
  }

  private removeEmptyUpi(): boolean {
    const index = this.upisControl().controls.findIndex(
      (control) => !control.value
    );
    if (index !== -1) {
      this.upisControl().removeAt(index, { emitEvent: false });
      //
      return true;
    }
    return false;
  }

  private updateUpisValidations(fromIndex: number) {
    for (let i = fromIndex; i < this.upisControl().length; i++) {
      this.setUPIValidations(this.upisControl().at(i), i);
    }
  }

  private initialIsUPI() {
    effect(() =>
      this.productControl().valueChanges.subscribe(() => {
        this.isUPI.set(this.productControl().value?.hasUpi ?? false);
        this.updateUpisValidations(0);
      })
    );
  }

  private initialSearchTerm() {
    this.searchControl.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((value) => {
        this.searchTerm.set(value as string);
      });
  }

  private watchDuplicate(firstIndex: number, duplicateIndex: number) {
    const firstControl = this.upisControl().at(firstIndex);
    const duplicateControl = this.upisControl().at(duplicateIndex);

    firstControl.valueChanges.pipe(first()).subscribe(() => {
      duplicateControl?.updateValueAndValidity();
    });
  }

  private createUpiDuplicateValidator(index: number): ValidatorFn {
    return (control: AbstractControl) => {
      const value = control.value;
      if (!value) return null;
      const otherMatchIndex = this.upisControl().controls.findIndex(
        (upi, i) => i !== index && upi.value === value
      );
      if (otherMatchIndex !== -1) {
        this.watchDuplicate(otherMatchIndex, index);
        return { duplicate: true };
      }
      return null;
    };
  }

  private setUPIValidations(
    control: FormControl<string | null>,
    index: number
  ) {
    control.clearValidators();
    if (this.isUPI()) {
      control.addValidators([
        Validators.required,
        this.createUpiDuplicateValidator(index),
      ]);
    }
    control.updateValueAndValidity();
  }

  protected addUpi(emitEvent = true) {
    const control = new FormControl('');
    const newIndex = this.upisControl().length;
    this.setUPIValidations(control, newIndex);
    this.upisControl().push(control, { emitEvent });
    return newIndex;
  }
}
