import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStore } from '../../store/user.store';

/**
 * Organization selection guard to ensure user has selected an organization
 * Redirects to home page if no organization is selected
 */
export const organizationGuard: CanActivateFn = () => {
  const userStore = inject(UserStore);
  const router = inject(Router);

  console.log('organization guard', userStore.selectedOrganizationId());

  if (userStore.selectedOrganizationId()) {
    return true;
  }

  userStore.loadPersistedOrganizationSelection();
  console.log(
    'organization guard after load',
    userStore.selectedOrganizationId()
  );

  if (userStore.selectedOrganizationId()) {
    return true;
  }

  // Redirect to home page for organization selection
  router.navigate(['/']);
  return false;
};
