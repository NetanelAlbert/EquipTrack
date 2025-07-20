import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Authentication guard to protect routes that require login
 * Redirects to login page if user is not authenticated
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isUserAuthenticated()) {
    return true;
  }

  // Redirect to login page
  router.navigate(['/login']);
  return false;
};
