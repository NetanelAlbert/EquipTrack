import { User, StartResponse } from '@equip-track/shared';

export const handler = async (
  user: User,
  req: undefined
): Promise<StartResponse> => {
  // TODO: Return actual start data
  return { status: true, dummyData: 'dummy' };
};
