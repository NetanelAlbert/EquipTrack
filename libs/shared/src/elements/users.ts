export enum UserState {
    Active = 'active',
    Invited = 'invited',
    Disabled = 'disabled',
}

export interface User {
    id: string;
    name: string;
    email: string; // needed?
    phone: string;
    department: string;
    departmentRole: string;
    organizations: UserInOrganization[];
    state: UserState;
}

export enum UserRole {
    Admin = 'admin',
    Customer = 'customer',
    WarehouseManager = 'warehouse-manager',
}

export interface UserInOrganization {
    organizationID: string;
    role: UserRole;
}