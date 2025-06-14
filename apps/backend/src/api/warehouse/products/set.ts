import { authenticate } from '../../auth';
import { validate } from '../../validate';
import { unauthorized, badRequest, ok } from '../../responses';

// Placeholder: import the relevant adapter if needed
// import { ProductAdapter } from '../../../../db/tables/product.adapter';

export const handler = async (event: any) => {
  const user = authenticate(event);
  if (!user) return unauthorized();

  const body =
    typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  if (!validate(body)) return badRequest();

  // TODO: Use ProductAdapter to set products
  return ok({ status: true });
};
