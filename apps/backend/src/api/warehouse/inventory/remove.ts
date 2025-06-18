import { User, RemoveInventory, BasicResponse } from '@equip-track/shared';
// import { InventoryAdapter } from '../../../../db/tables/inventory.adapter';

export const handler = async (
  user: User,
  req: RemoveInventory
): Promise<BasicResponse> => {
  // TODO: Use InventoryAdapter to remove inventory
  return { status: true };
};
