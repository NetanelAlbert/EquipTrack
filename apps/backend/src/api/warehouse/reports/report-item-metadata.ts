import { ItemReport, UserInOrganization } from '@equip-track/shared';
import { WAREHOUSE_SUFFIX } from '../../../db/constants';

export function buildOwnerAndDepartmentFields(
  holderId: string | undefined,
  organizationId: string,
  getUserInOrganization: (
    userId: string,
    orgId: string
  ) => Promise<UserInOrganization | undefined>
): Promise<Pick<ItemReport, 'ownerUserId' | 'departmentId' | 'subDepartmentId'>> {
  if (holderId === undefined) {
    return Promise.resolve({});
  }

  if (holderId.endsWith(WAREHOUSE_SUFFIX)) {
    return Promise.resolve({ ownerUserId: holderId });
  }

  return (async () => {
    const ownerUserId = holderId;
    const uio = await getUserInOrganization(holderId, organizationId);
    const dept = uio?.department;
    if (!dept) {
      return { ownerUserId };
    }
    return {
      ownerUserId,
      departmentId: dept.id,
      ...(dept.subDepartmentId !== undefined && {
        subDepartmentId: dept.subDepartmentId,
      }),
    };
  })();
}
