import { GetUsersResponse, ActiveUser } from '@equip-track/shared';
// import { OrganizationAdapter } from '../../../db/tables/organization.adapter';

export const handler = async (
  user: ActiveUser,
  req: undefined
): Promise<GetUsersResponse> => {
  // TODO: Use OrganizationAdapter to get users
  // For now, just return a dummy users list
  return { users: [], status: true };
};
