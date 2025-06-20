import { ActiveUser, GetInventoryResponse } from '@equip-track/shared';
// import { InventoryAdapter } from '../../../../db/tables/inventory.adapter';

export const handler = async (
  user: ActiveUser,
  req: undefined
): Promise<GetInventoryResponse> => {
  // TODO: Use InventoryAdapter to get inventory
  return { items: [], status: true };
};
