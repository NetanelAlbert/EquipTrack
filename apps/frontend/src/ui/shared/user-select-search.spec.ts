import {
  UserAndUserInOrganization,
  UserRole,
  UserState,
} from '@equip-track/shared';
import { userMatchesSelectSearch } from './user-select-search';

describe('userMatchesSelectSearch', () => {
  const deptNames: Record<string, string> = {
    d1: 'Main Dept',
    d2: 'Sub Dept',
  };
  const resolve: (id: string) => string = (id) => deptNames[id] ?? '';

  const baseUser = (): UserAndUserInOrganization => ({
    user: {
      id: 'u1',
      name: 'Alice Example',
      email: 'a@example.com',
      state: UserState.Active,
    },
    userInOrganization: {
      organizationId: 'o1',
      userId: 'u1',
      role: UserRole.Customer,
      department: {
        id: 'd1',
        roleDescription: 'Technician',
        subDepartmentId: 'd2',
      },
    },
  });

  it('returns true for empty search term', () => {
    expect(userMatchesSelectSearch('  ', baseUser(), resolve)).toBe(true);
  });

  it('matches user name (case-insensitive)', () => {
    expect(userMatchesSelectSearch('alice', baseUser(), resolve)).toBe(true);
    expect(userMatchesSelectSearch('EXAMPLE', baseUser(), resolve)).toBe(true);
  });

  it('matches main department name', () => {
    expect(userMatchesSelectSearch('main', baseUser(), resolve)).toBe(true);
  });

  it('matches sub-department name', () => {
    expect(userMatchesSelectSearch('sub', baseUser(), resolve)).toBe(true);
  });

  it('matches role description', () => {
    expect(userMatchesSelectSearch('tech', baseUser(), resolve)).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(userMatchesSelectSearch('zzz', baseUser(), resolve)).toBe(false);
  });

  it('returns false when user has no department', () => {
    const u = baseUser();
    u.userInOrganization = { ...u.userInOrganization, department: undefined };
    expect(userMatchesSelectSearch('main', u, resolve)).toBe(false);
  });
});
