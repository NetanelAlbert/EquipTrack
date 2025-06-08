import { Route } from '@angular/router';
import { DummyComponent } from '../ui';
import { navItems } from '../ui/side-nav/nav-items';

const navItemsRoutes = navItems.map((item) => ({
  path: item.route,
  component: item.component,
  title: item.labelKey,
}));

export const appRoutes: Route[] = [
  ...navItemsRoutes,
  {
    path: '**',
    component: DummyComponent,
    title: 'Dummy Page',
  },
];
