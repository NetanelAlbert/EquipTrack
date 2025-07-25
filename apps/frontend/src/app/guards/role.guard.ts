import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@equip-track/shared';
import { UserStore } from '../../store/user.store';
import { AuthService } from '../../services/auth.service';

export const createRoleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const userStore = inject(UserStore);
    const authService = inject(AuthService);

    if (!authService.isUserAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    if (!userStore.hasRole(allowedRoles)) {
      router.navigate(['/not-allowed']);
      return false;
    }

    return true;
  };
};
