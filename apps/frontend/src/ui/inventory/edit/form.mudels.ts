import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { InventoryItem, Product } from '@equip-track/shared';
export interface FormInventoryItem {
  productId: FormControl<string | null>;
  quantity: FormControl<number | null>;
  upis: FormArray<FormControl<string | null>>;
}

export const FormInventoryItemMapper = (
  formItem: FormInventoryItem,
  getProduct: (productID: string) => Product | undefined
): InventoryItem => {
  const product = getProduct(formItem.productId.value ?? '');
  const upis = product?.hasUpi
    ? formItem.upis.value.filter(
        (upi): upi is string => upi !== null && upi !== ''
      )
    : undefined;
  return {
    productId: formItem.productId.value ?? '',
    quantity: formItem.quantity.value ?? 0,
    upis,
  };
};

export const FormInventoryItemMapperFromItem = (
  fb: FormBuilder,
  item: InventoryItem,
  limitValidator: ValidatorFn
): FormGroup<FormInventoryItem> => {
  return fb.group(
    {
      productId: [item.productId, [Validators.required]],
      quantity: [
        item.quantity,
        [
          Validators.required,
          Validators.min(1),
          Validators.pattern(/^[0-9]*$/),
        ],
      ],
      upis: fb.array<string>(item.upis ?? []),
    },
    {
      validators: [limitValidator],
    }
  );
};

export const emptyItem: (
  fb: FormBuilder,
  limitValidator: ValidatorFn
) => FormGroup<FormInventoryItem> = (fb, limitValidator) => {
  return FormInventoryItemMapperFromItem(
    fb,
    {
      productId: '',
      quantity: 1,
      upis: [''],
    },
    limitValidator
  );
};
