import { FormStatus, FormType, InventoryItem } from '@equip-track/shared';

export interface FormQueryParams {
  formType: FormType;
  searchStatus: FormStatus;
  searchTerm: string;
}

export interface CreateFormQueryParams {
  formType: FormType;
  userId?: string;
  items: InventoryItem[];
  description?: string;
}