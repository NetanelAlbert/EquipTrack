import { User, SetUser, BasicResponse } from '@equip-track/shared';
// import { OrganizationAdapter } from '../../../db/tables/organization.adapter';

export const handler = async (
  user: User,
  req: SetUser
): Promise<BasicResponse> => {
  // TODO: Use OrganizationAdapter to add user
  return { status: true };
};
