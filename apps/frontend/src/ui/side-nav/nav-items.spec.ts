import { UserRole } from '@equip-track/shared';
import { navItems } from './nav-items';

describe('navItems role access', () => {
  it('should allow inspector role only on reports-history route', () => {
    const routesWithInspector = navItems
      .filter((item) => item.roles.includes(UserRole.Inspector))
      .map((item) => item.route);

    expect(routesWithInspector).toEqual(['reports-history']);
  });
});
