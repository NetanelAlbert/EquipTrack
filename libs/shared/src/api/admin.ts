import {
  UserRole,
  UserInOrganization,
  UserAndUserInOrganization,
  UserDepartment,
} from '../elements';
import { BasicResponse } from './basic';

export interface GetUsersResponse extends BasicResponse {
  users: UserAndUserInOrganization[];
}

export interface SetUser {
  userInOrganization: UserInOrganization;
}

export interface InviteUser {
  email: string;
  organizationId: string;
  role: UserRole;
  department: UserDepartment;
}
