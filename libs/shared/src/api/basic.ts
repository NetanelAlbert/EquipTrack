import { ErrorKeys } from './error-keys';

export interface BasicResponse {
  status: boolean;
  error?: string;
  errorMessage?: string;
  errorKey?: ErrorKeys;
}
