import { ActiveUser, RejectCheckOut, BasicResponse } from '@equip-track/shared';
// import { InventoryFormAdapter } from '../../../../db/tables/inventory-form.adapter';

export const handler = async (
  user: ActiveUser,
  req: RejectCheckOut
): Promise<BasicResponse> => {
  // TODO: Use InventoryFormAdapter to reject checkout
  return { status: true };
};
