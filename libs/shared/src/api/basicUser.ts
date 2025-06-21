import { InventoryItem, ItemReport, Organization, User, UserInOrganization } from '../elements';
import { BasicResponse } from './basic';

export interface StartResponse extends BasicResponse {
  user: User;
  userInOrganizations: UserInOrganization[];
  organizations: Organization[];
}

export interface ApproveCheckOut {
  formID: string;
  imageData: Blob; // todo check if this is correct
}

export interface RejectCheckOut {
  formID: string;
  reason: string;
}

export interface RequestCheckIn {
  items: InventoryItem[];
}

export interface ReportItems {
  items: ItemReport[];
}
