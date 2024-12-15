import { FormArray, FormControl } from "@angular/forms";
import { InventoryItem } from "@equip-track/shared";

export interface FormInventoryItem {
    productID: FormControl<string | null>;
    quantity: FormControl<number | null>;
    upis: FormArray<FormControl<string | null>>;
}

export const FormInventoryItemMapper = (formItem: FormInventoryItem): InventoryItem => {
    return {
        productID: formItem.productID.value ?? '',
        quantity: formItem.quantity.value ?? 0,
        upis: formItem.upis.value.filter((upi): upi is string => upi !== null),
    };
}