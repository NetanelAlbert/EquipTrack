import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../store';

export const createAuthGuard = (): CanActivateFn => {
  return () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    // Check if user is authenticated
    if (authStore.isAuthenticated()) {
      return true;
    }

    // Redirect to login if not authenticated
    router.navigate(['/login']);
    return false;
  };
};
