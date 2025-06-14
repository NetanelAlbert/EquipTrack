import { authenticate } from '../../../api/auth';
import { validate } from '../../../api/validate';
import { unauthorized, badRequest, ok } from '../../../api/responses';
// import { InventoryFormAdapter } from '../../../../db/tables/inventory-form.adapter';

export const handler = async (event: any) => {
  const user = authenticate(event);
  if (!user) return unauthorized();

  const body =
    typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  if (!validate(body)) return badRequest();

  // TODO: Use InventoryFormAdapter to request check-in
  return ok({ status: true });
};
