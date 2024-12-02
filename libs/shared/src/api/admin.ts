

// USERS

import { User } from "../elements";

/**
 * GET /api/admin/users
 */
export interface GetUsersResponse {
    users: User[];
}

/**
 * POST /api/admin/users/add
 */
export interface AddUser {
    user: User;
}

/**
 * POST /api/admin/users/update
 */
export interface UpdateUser {
    user: User;
}
