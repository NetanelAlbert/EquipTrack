import { Route } from '@angular/router';
import { createRoleGuard } from './guards/role.guard';
import { authGuard } from './guards/auth.guard';
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
      canActivate: [authGuard, createRoleGuard(item.roles)], // Add auth guard before role guard
    };
  } else {
    // Eager loaded component (DummyComponent)
    return {
      path: item.route,
      component: DummyComponent,
      title: item.labelKey,
      canActivate: [authGuard, createRoleGuard(item.roles)], // Add auth guard before role guard
    };
  }
});

export const appRoutes: Route[] = [
  // Authentication routes (no guards)
  {
    path: 'login',
    loadComponent: () =>
      import('../ui/login/login.component').then((m) => m.LoginComponent),
    title: 'auth.sign-in-title',
  },

  // Protected routes
  ...navItemRoutes,

  // Public routes
  {
    path: 'not-allowed',
    component: NotAllowedComponent,
    title: 'errors.not-allowed.title',
  },

  // Default redirect
  {
    path: '',
    redirectTo: 'my-items',
    pathMatch: 'full',
  },

  // Catch-all route
  {
    path: '**',
    redirectTo: 'login',
  },
];
