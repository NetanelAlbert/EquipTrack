import { User, RequestCheckIn, BasicResponse } from '@equip-track/shared';
// import { InventoryFormAdapter } from '../../../../db/tables/inventory-form.adapter';

export const handler = async (
  user: User,
  req: RequestCheckIn
): Promise<BasicResponse> => {
  // TODO: Use InventoryFormAdapter to request check-in
  return { status: true };
};
