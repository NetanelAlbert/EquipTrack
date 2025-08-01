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

export interface ApproveCheckOut {
  formID: string;
  userId: string; // form user id
  signature: string;
}

export interface ApproveCheckOutResponse extends BasicResponse {
  updatedForm: InventoryForm;
}

export interface RejectCheckOut {
  formID: string;
  reason: string;
}

export interface RequestCheckIn {
  items: InventoryItem[];
  userId: string;
}

export interface RequestCheckInResponse extends BasicResponse {
  form: InventoryForm;
}

export interface ReportItems {
  items: ItemReport[];
}

export interface GetPresignedUrlResponse extends BasicResponse {
  presignedUrl: string;
}