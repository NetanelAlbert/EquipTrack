import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStore } from '../../store';
import { UserRole } from '@equip-track/shared';

export const createRoleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const userStore = inject(UserStore);
    const router = inject(Router);

    // Get user's role from the first organization (assuming single organization for now)
    const userRole = userStore.activeOrganization.role();
    if (!userRole) {
      router.navigate(['/not-allowed']);
      return false;
    }

    // Check if user's role is allowed to access this route
    const hasAccess = allowedRoles.includes(userRole);

    if (!hasAccess) {
      router.navigate(['/not-allowed']);
      return false;
    }

    return true;
  };
};
