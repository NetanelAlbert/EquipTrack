import { test, expect } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { authenticateWithE2eToken } from './helpers/e2e-auth';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test('loads organization selection with deterministic e2e auth', async ({
  page,
  request,
}) => {
  await authenticateWithE2eToken(page, request, {
    backendBaseUrl,
    e2eSecret,
    userId: 'user-e2e-admin',
    orgIdToRole: {
      'org-e2e-main': UserRole.Admin,
    },
  });

  await page.goto('/');

  await expect(page.getByTestId('organization-selection-page')).toBeVisible();
  await expect(page.getByTestId('organization-card-org-e2e-main')).toBeVisible();
});
