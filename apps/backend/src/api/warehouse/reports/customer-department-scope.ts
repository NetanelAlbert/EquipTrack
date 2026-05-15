import { getUserIDsOfSameSubDepartment } from '@equip-track/shared';
import { UsersAndOrganizationsAdapter } from '../../../db';

/**
 * Returns the set of user IDs whose items a customer is allowed to see:
 * the customer themselves plus every user that shares the same sub-department.
 */
export async function getCustomerDepartmentScope(
  userId: string,
  organizationId: string
): Promise<Set<string>> {
  const usersAdapter = new UsersAndOrganizationsAdapter();
  const users = await usersAdapter.getUsersByOrganization(organizationId);

  const currentUser = users.find((u) => u.user.id === userId);
  if (!currentUser) {
    return new Set([userId]);
  }

  const departmentUserIds = getUserIDsOfSameSubDepartment(users, currentUser);
  const allowed = new Set(departmentUserIds);
  allowed.add(userId);
  return allowed;
}
