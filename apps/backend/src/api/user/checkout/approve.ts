import { ActiveUser, ApproveCheckOut, BasicResponse } from '@equip-track/shared';
// import { InventoryFormAdapter } from '../../../../db/tables/inventory-form.adapter';

export const handler = async (
  user: ActiveUser,
  req: ApproveCheckOut
): Promise<BasicResponse> => {
  // TODO: Use InventoryFormAdapter to approve checkout
  return { status: true };
};
