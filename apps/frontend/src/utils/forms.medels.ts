import { FormStatus, FormType } from '@equip-track/shared';

export interface FormQueryParams {
  formType: FormType;
  searchStatus: FormStatus;
  searchTerm: string;
}