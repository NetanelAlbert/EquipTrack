import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { InventoryItem, Product } from '@equip-track/shared';
export interface FormInventoryItem {
  product: FormControl<Product | null>;
  quantity: FormControl<number | null>;
  upis: FormArray<FormControl<string | null>>;
}

export const FormInventoryItemMapper = (
  formItem: FormInventoryItem
): InventoryItem => {
  const upis = formItem.product.value?.upi
    ? formItem.upis.value.filter(
        (upi): upi is string => upi !== null && upi !== ''
      )
    : undefined;
  return {
    productID: formItem.product.value?.id ?? '',
    quantity: formItem.quantity.value ?? 0,
    upis,
  };
};

export const FormInventoryItemMapperFromItem = (
  fb: FormBuilder,
  item: InventoryItem,
  product: Product | null
): FormGroup<FormInventoryItem> => {
  return fb.group({
    product: [product, [Validators.required]],
    quantity: [
      item.quantity,
      [Validators.required, Validators.min(1), Validators.pattern(/^[0-9]*$/)],
    ],
    upis: fb.array<string>(item.upis ?? ['']),
  });
};

export const emptyItem: (fb: FormBuilder) => FormGroup<FormInventoryItem> = (
  fb
) => {
  return FormInventoryItemMapperFromItem(
    fb,
    {
      productID: '',
      quantity: 1,
      upis: undefined,
    },
    null
  );
};
