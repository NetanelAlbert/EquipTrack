import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserRole } from '@equip-track/shared';

export const createRoleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // First check if user is authenticated
    if (!authService.isUserAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    // Check if user has required role
    if (!authService.hasRole(allowedRoles)) {
      router.navigate(['/not-allowed']);
      return false;
    }

    return true;
  };
};
