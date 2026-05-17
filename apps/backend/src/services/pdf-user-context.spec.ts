import {
  UserRole,
  UserState,
  type User,
} from '@equip-track/shared';
import type { UsersAndOrganizationsAdapter } from '../db/tables/users-and-organizations.adapter';
import {
  loadPdfUserContext,
  pdfResolvedUserName,
} from './pdf-user-context';

describe('pdf-user-context', () => {
  const holderUser: User = {
    id: 'user-holder',
    name: 'Holder',
    email: 'h@example.com',
    state: UserState.Active,
  };

  const approverUser: User = {
    id: 'user-approver',
    name: 'Approver אישור',
    email: 'a@example.com',
    state: UserState.Active,
  };

  it('loads holder unit name from department roleDescription', async () => {
    const adapter = {
      getUserFromDB: jest.fn().mockResolvedValue(holderUser),
      getUserInOrganization: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        userId: holderUser.id,
        role: UserRole.Customer,
        department: {
          id: 'dep-1',
          roleDescription: 'יחידת בדיקות',
        },
      }),
    } as unknown as UsersAndOrganizationsAdapter;

    const ctx = await loadPdfUserContext(adapter, 'org-1', holderUser.id, []);
    expect(ctx.holderUnitName).toBe('יחידת בדיקות');
  });

  it('collects names for holder and extra ids without throwing on lookup gaps', async () => {
    const adapter = {
      getUserFromDB: jest
        .fn()
        .mockImplementation(async (id: string) =>
          id === holderUser.id ? holderUser : id === approverUser.id ? approverUser : undefined
        ),
      getUserInOrganization: jest.fn().mockResolvedValue(undefined),
    } as unknown as UsersAndOrganizationsAdapter;

    const ctx = await loadPdfUserContext(adapter, 'org-1', holderUser.id, [
      approverUser.id,
      'missing-user',
    ]);

    expect(ctx.userNamesById[holderUser.id]).toBe(holderUser.name);
    expect(ctx.userNamesById[approverUser.id]).toBe(approverUser.name);
    expect(ctx.userNamesById['missing-user']).toBeUndefined();
  });

  it('pdfResolvedUserName falls back to raw id', () => {
    const ctx = { userNamesById: {}, holderUnitName: undefined };
    expect(pdfResolvedUserName('uuid-raw', ctx)).toBe('uuid-raw');
    expect(pdfResolvedUserName(undefined, ctx)).toBe('');
  });
});
