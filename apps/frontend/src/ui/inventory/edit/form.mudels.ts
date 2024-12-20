import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { InventoryItem, Product } from "@equip-track/shared";
export interface FormInventoryItem {
    product: FormControl<Product | null>;
    quantity: FormControl<number | null>;
    upis: FormArray<FormControl<string | null>>;
}

export const FormInventoryItemMapper = (formItem: FormInventoryItem): InventoryItem => {
    return {
        productID: formItem.product.value?.id ?? '',
        quantity: formItem.quantity.value ?? 0,
        upis: formItem.upis.value.filter((upi): upi is string => upi !== null),
    };
}

export const emptyItem: (fb: FormBuilder) => FormGroup<FormInventoryItem> = (fb) => {
    return fb.group({
      product: [null as Product | null, Validators.required],
      quantity: [1, Validators.required],
      upis: fb.array<string>(['']),
    });
  }