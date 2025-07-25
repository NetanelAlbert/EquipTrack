import { Route } from '@angular/router';
import { createRoleGuard } from './guards/role.guard';
import { authGuard } from './guards/auth.guard';
import { organizationGuard } from './guards/organization.guard';
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
      canActivate: [authGuard, organizationGuard, createRoleGuard(item.roles)], // Auth -> Org -> Role guards
    };
  } else {
    // Eager loaded component (DummyComponent)
    return {
      path: item.route,
      component: DummyComponent,
      title: item.labelKey,
      canActivate: [authGuard, organizationGuard, createRoleGuard(item.roles)], // Auth -> Org -> Role guards
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

  // Organization selection (requires auth but not organization)
  {
    path: '',
    loadComponent: () =>
      import('../ui/home/home.component').then((m) => m.HomeComponent),
    title: 'organization.select.title',
    canActivate: [authGuard], // Only auth required, not organization
    pathMatch: 'full',
  },

  // Protected routes (require auth + organization + role)
  ...navItemRoutes,

  // Public routes
  {
    path: 'not-allowed',
    component: NotAllowedComponent,
    title: 'errors.not-allowed.title',
  },

  // Catch-all route
  {
    path: '**',
    redirectTo: 'login',
  },
];
