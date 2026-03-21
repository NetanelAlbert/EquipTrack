import { UserRole } from '../elements/users';
import { endpointMetas } from './endpoints';

describe('endpointMetas inspector access', () => {
  it('should allow inspector for start and report history endpoints', () => {
    expect(endpointMetas.start.allowedRoles).toContain(UserRole.Inspector);
    expect(endpointMetas.getReportsByDates.allowedRoles).toContain(
      UserRole.Inspector
    );
  });

  it('should not allow inspector for restricted inventory endpoints', () => {
    expect(endpointMetas.getInventory.allowedRoles).not.toContain(
      UserRole.Inspector
    );
    expect(endpointMetas.addInventory.allowedRoles).not.toContain(
      UserRole.Inspector
    );
    expect(endpointMetas.removeInventory.allowedRoles).not.toContain(
      UserRole.Inspector
    );
  });
});
