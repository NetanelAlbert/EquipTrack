export enum UserState {
  Active = 'active',
  Invited = 'invited',
  Disabled = 'disabled',
}

/**
 * Represents the core metadata for a User account.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  state: UserState;
}

export enum UserRole {
  Admin = 'admin',
  Customer = 'customer',
  WarehouseManager = 'warehouse-manager',
}

export interface UserInOrganization {
  organizationId: string;
  userId: string;
  role: UserRole;
  department?: string;
  departmentRole?: string;
}
