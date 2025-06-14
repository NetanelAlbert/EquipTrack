import { authenticate } from '../../auth';
import { validate } from '../../validate';
import { unauthorized, badRequest, ok } from '../../responses';
// import { InventoryFormAdapter } from '../../../../db/tables/inventory-form.adapter';

export const handler = async (event: any) => {
  const user = authenticate(event);
  if (!user) return unauthorized();

  const body =
    typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  if (!validate(body)) return badRequest();

  // TODO: Use InventoryFormAdapter to reject checkout
  // For now, just return a dummy response
  return ok({ status: true });
};
