import { UserAndUserInOrganization } from "../elements";

export function getUserIDsOfSameSubDepartment(users: UserAndUserInOrganization[], userAndUserInOrganization: UserAndUserInOrganization) : string[] {
    if (!userAndUserInOrganization.userInOrganization.department) {
        return [];
    }

    return users.filter((u) => 
        u.userInOrganization.department?.id === userAndUserInOrganization.userInOrganization.department?.id &&
        u.userInOrganization.department?.subDepartmentId === userAndUserInOrganization.userInOrganization.department?.subDepartmentId)
        .map((u) => u.user.id);
}