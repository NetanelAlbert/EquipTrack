import {
  CheckInEvent,
  InventoryForm,
  InventoryItem,
  Organization,
  User,
  UserInOrganization,
} from '../elements';
import { BasicResponse } from './basic';

export interface StartResponse extends BasicResponse {
  user: User;
  userInOrganizations: UserInOrganization[];
  organizations: Organization[];
  refreshedToken?: string;
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

export interface RejectFormResponse extends BasicResponse {
  updatedForm: InventoryForm;
}

export interface GetPresignedUrlResponse extends BasicResponse {
  presignedUrl: string;
}

export interface RecordCheckIn {
  /** Subset of the check-out form's items to return in this event. */
  items: InventoryItem[];
  /** Warehouse-side approver signature (data URL). */
  signature: string;
}

export interface RecordCheckInResponse extends BasicResponse {
  updatedForm: InventoryForm;
  event: CheckInEvent;
}