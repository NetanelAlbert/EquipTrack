import { Route } from '@angular/router';
import { createRoleGuard } from './guards/role.guard';
import { NotAllowedComponent } from '../ui/not-allowed/not-allowed.component';
import { DummyComponent } from '../ui';
import { navItems } from '../ui/side-nav/nav-items';

// Generate routes from nav items (single source of truth)
const navItemRoutes: Route[] = navItems.map((item) => {
  if (item.loadComponent) {
    // Lazy loaded component
    return {
      path: item.route,
      loadComponent: item.loadComponent,
      title: item.labelKey,
      canActivate: [createRoleGuard(item.roles)],
    };
  } else {
    // Eager loaded component (DummyComponent)
    return {
      path: item.route,
      component: DummyComponent,
      title: item.labelKey,
      canActivate: [createRoleGuard(item.roles)],
    };
  }
});

export const appRoutes: Route[] = [
  ...navItemRoutes,
  {
    path: 'not-allowed',
    component: NotAllowedComponent,
    title: 'Not Allowed',
  },
  {
    path: '',
    redirectTo: 'my-items',
    pathMatch: 'full',
  },
  {
    path: '**',
    component: DummyComponent,
    title: 'Dummy Page',
  },
];
