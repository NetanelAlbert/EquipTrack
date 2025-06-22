import { User, StartResponse, UserInOrganization, Organization } from '@equip-track/shared';
import { MainAdapter } from '../db';
import { resourceNotFound } from './responses';

const mainAdapter = new MainAdapter();

export const handler = async (
  user: User,
): Promise<StartResponse> => {
  const userAndAllOrganizations = await mainAdapter.getUserAndAllOrganizations(user.id);
  if (!userAndAllOrganizations) {
    throw resourceNotFound('User not found');
  }
  const { user: userFromDb, userInOrganizations } = userAndAllOrganizations;
  const organizations: Organization[] = await getOrganizations(userInOrganizations);
  validateUserInOrganizations(userInOrganizations, organizations);
  return { status: true, user: userFromDb, userInOrganizations, organizations };
};

async function getOrganizations(userInOrganizations: UserInOrganization[]): Promise<Organization[]> {
  const organizationIds: string[] = userInOrganizations.map(u => u.organizationId);
  return await mainAdapter.getOrganizations(organizationIds);
}

function validateUserInOrganizations(userInOrganizations: UserInOrganization[], organizations: Organization[]) {
  userInOrganizations.forEach(u => {
    if (!organizations.some(o => o.id === u.organizationId)) {
      throw resourceNotFound(`Organization not found (organizationId: ${u.organizationId})`);
    }
  });
}