import { ok } from '../../responses';
import { User, GetUsersResponse } from '@equip-track/shared';
// import { OrganizationAdapter } from '../../../db/tables/organization.adapter';

export const handler = async (
  user: User,
  req: undefined
): Promise<GetUsersResponse> => {
  // TODO: Use OrganizationAdapter to get users
  // For now, just return a dummy users list
  return { users: [], status: true };
};
