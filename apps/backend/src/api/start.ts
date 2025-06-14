import { authenticate } from './auth';
import { unauthorized, ok } from './responses';

export const handler = async (event: any) => {
  const user = authenticate(event);
  if (!user) return unauthorized();

  // TODO: Return actual start data
  return ok({ status: true, dummyData: 'dummy' });
};
