import { authenticate } from '../../auth';
import { validate } from '../../validate';
import { unauthorized, badRequest, ok } from '../../responses';
// import { OrganizationAdapter } from '../../../db/tables/organization.adapter';

export const handler = async (event: any) => {
  const user = authenticate(event);
  if (!user) return unauthorized();

  const body =
    typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  if (!validate(body)) return badRequest();

  // TODO: Use OrganizationAdapter to add user
  return ok({ status: true });
};
