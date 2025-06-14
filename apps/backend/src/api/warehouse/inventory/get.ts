import { authenticate } from '../../auth';
import { unauthorized, ok } from '../../responses';
// import { InventoryAdapter } from '../../../../db/tables/inventory.adapter';

export const handler = async (event: any) => {
  const user = authenticate(event);
  if (!user) return unauthorized();

  // TODO: Use InventoryAdapter to get inventory
  return ok({ items: [] });
};
