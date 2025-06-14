import { authenticate } from '../../auth';
import { unauthorized, ok } from '../../responses';
// import { OrganizationAdapter } from '../../../db/tables/organization.adapter';

export const handler = async (event: any) => {
  const user = authenticate(event);
  if (!user) return unauthorized();

  // TODO: Use OrganizationAdapter to get users
  // For now, just return a dummy users list
  return ok({ users: [] });
};
