import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OrganizationSelectionService } from '../../services/organization-selection.service';

/**
 * Organization selection guard to ensure user has selected an organization
 * Redirects to home page if no organization is selected
 */
export const organizationGuard: CanActivateFn = () => {
  const organizationService = inject(OrganizationSelectionService);
  const router = inject(Router);

  if (organizationService.hasSelectedOrganization()) {
    return true;
  }

  // Redirect to home page for organization selection
  router.navigate(['/']);
  return false;
};
