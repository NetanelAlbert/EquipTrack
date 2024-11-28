

// USERS

import { User } from "../elements/organization";

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

/**
 * DELETE /api/admin/users/delete
 */
export interface DeleteUser {
    userID: string;
}
