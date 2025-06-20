import { User } from '../elements';
import { BasicResponse } from './basic';

export interface GetUsersResponse extends BasicResponse {
  users: User[];
}

export interface SetUser {
  user: User;
}
