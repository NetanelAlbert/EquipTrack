import { UserAndUserInOrganization } from '@equip-track/shared';

export type DepartmentNameResolver = (departmentId: string) => string;

/**
 * Filter predicate for user pickers: matches name, department labels, and role text.
 */
export function userMatchesSelectSearch(
  term: string,
  item: UserAndUserInOrganization,
  getDepartmentName: DepartmentNameResolver
): boolean {
  const q = term.toLowerCase().trim();
  if (!q) {
    return true;
  }

  if (item.user.name.toLowerCase().includes(q)) {
    return true;
  }

  const department = item.userInOrganization?.department;
  if (!department) {
    return false;
  }

  const main = getDepartmentName(department.id)?.toLowerCase() ?? '';
  if (main.includes(q)) {
    return true;
  }

  if (department.subDepartmentId) {
    const sub =
      getDepartmentName(department.subDepartmentId)?.toLowerCase() ?? '';
    if (sub.includes(q)) {
      return true;
    }
  }

  const role = department.roleDescription?.toLowerCase() ?? '';
  return role.includes(q);
}
