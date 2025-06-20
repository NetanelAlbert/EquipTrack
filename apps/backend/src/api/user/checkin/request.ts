import { ActiveUser, RequestCheckIn, BasicResponse } from '@equip-track/shared';
// import { InventoryFormAdapter } from '../../../../db/tables/inventory-form.adapter';

export const handler = async (
  user: ActiveUser,
  req: RequestCheckIn
): Promise<BasicResponse> => {
  // TODO: Use InventoryFormAdapter to request check-in
  return { status: true };
};
