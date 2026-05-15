import { UserRole } from '@equip-track/shared';
import { buildOwnerAndDepartmentFields } from './report-item-metadata';

describe('buildOwnerAndDepartmentFields', () => {
  it('returns empty when holder is undefined', async () => {
    const result = await buildOwnerAndDepartmentFields(
      undefined,
      'org-1',
      async () => undefined
    );
    expect(result).toEqual({});
  });

  it('sets ownerUserId for warehouse holder', async () => {
    const result = await buildOwnerAndDepartmentFields(
      'HOLDER_WAREHOUSE',
      'org-1',
      async () => undefined
    );
    expect(result).toEqual({ ownerUserId: 'HOLDER_WAREHOUSE' });
  });

  it('loads department from user-org for regular holder', async () => {
    const result = await buildOwnerAndDepartmentFields(
      'user-1',
      'org-1',
      async (uid, oid) => {
        expect(uid).toBe('user-1');
        expect(oid).toBe('org-1');
        return {
          organizationId: oid,
          userId: uid,
          role: UserRole.Customer,
          department: {
            id: 'dept-a',
            roleDescription: '',
            subDepartmentId: 'sub-b',
          },
        };
      }
    );
    expect(result).toEqual({
      ownerUserId: 'user-1',
      departmentId: 'dept-a',
      subDepartmentId: 'sub-b',
    });
  });
});
