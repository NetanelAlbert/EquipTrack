import { Route } from '@angular/router';
import { DummyComponent } from '../ui';
import { navItems } from '../ui/side-nav/nav-items';
import { createRoleGuard } from './guards/role.guard';
import { NotAllowedComponent } from '../ui/not-allowed/not-allowed.component';

const navItemsRoutes = navItems.map((item) => ({
  path: item.route,
  component: item.component,
  title: item.labelKey,
  canActivate: [createRoleGuard(item.roles)],
}));

export const appRoutes: Route[] = [
  ...navItemsRoutes,
  {
    path: 'not-allowed',
    component: NotAllowedComponent,
    title: 'Not Allowed',
  },
  {
    path: '**',
    component: DummyComponent,
    title: 'Dummy Page',
  },
];
