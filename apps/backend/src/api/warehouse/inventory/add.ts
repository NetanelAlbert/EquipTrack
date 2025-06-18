import { User, AddInventory, BasicResponse } from '@equip-track/shared';
// import { InventoryAdapter } from '../../../../db/tables/inventory.adapter';

export const handler = async (
  user: User,
  req: AddInventory
): Promise<BasicResponse> => {
  // TODO: Use InventoryAdapter to add inventory
  return { status: true };
};
