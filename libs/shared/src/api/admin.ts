import { User, UserRole } from '../elements';
import { BasicResponse } from './basic';

export interface GetUsersResponse extends BasicResponse {
  users: User[];
}

export interface SetUser {
  user: User;
}

export interface InviteUser {
  email: string;
  organizationId: string;
  role: UserRole;
  department?: string;
  departmentRole?: string;
}
