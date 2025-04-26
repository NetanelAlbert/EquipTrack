
export interface User {
    id: string;
    name: string;
    email: string; // needed?
    phone: string;
    department: string;
    departmentRole: string;
    organizations: UserInOrganization[];
    state: 'active' | 'invited' | 'disabled';
}

export interface UserInOrganization {
    organizationID: string;
    role: 'admin' | 'user' | 'warehouse';
}