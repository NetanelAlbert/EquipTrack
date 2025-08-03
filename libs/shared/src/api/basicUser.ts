import {
  InventoryForm,
  InventoryItem,
  ItemReport,
  Organization,
  User,
  UserInOrganization,
} from '../elements';
import { BasicResponse } from './basic';

export interface StartResponse extends BasicResponse {
  user: User;
  userInOrganizations: UserInOrganization[];
  organizations: Organization[];
}

export interface ApproveForm {
  formID: string;
  userId: string; // form user id
  signature: string;
}

export interface ApproveFormResponse extends BasicResponse {
  updatedForm: InventoryForm;
}

export interface RejectForm {
  userId: string; // form user id
  formID: string;
  reason: string;
}

export interface GetPresignedUrlResponse extends BasicResponse {
  presignedUrl: string;
}