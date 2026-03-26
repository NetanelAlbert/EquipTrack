import { test, expect } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from '../helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
} from '../helpers/e2e-navigation';
import { E2E_ORG_ID } from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

const CUSTOMER_ROUTES = ['my-items', 'today-report', 'reports-history', 'my-forms'];
const ADMIN_ONLY_ROUTES = ['edit-users'];
const WAREHOUSE_ADMIN_ROUTES = [
  'edit-products',
  'all-inventory',
  'inventory-by-users',
  'add-inventory',
  'remove-inventory',
  'create-form',
  'forms',
];

async function openSideNav(page: import('@playwright/test').Page) {
  const toggle = page.getByTestId('menu-toggle-button');
  await toggle.click();
  await page.getByTestId('side-nav-list').waitFor({ state: 'visible', timeout: 5000 });
}

test.describe('navigation and role-based access control', () => {
  test('customer sees only 4 nav items', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-customer',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Customer },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await openSideNav(page);

    for (const route of CUSTOMER_ROUTES) {
      await expect(page.getByTestId(`nav-link-${route}`)).toBeVisible({
        timeout: 10000,
      });
    }

    for (const route of [...WAREHOUSE_ADMIN_ROUTES, ...ADMIN_ONLY_ROUTES]) {
      await expect(page.getByTestId(`nav-link-${route}`)).not.toBeAttached();
    }
  });

  test('customer redirect to not-allowed for admin routes', async ({
    page,
    request,
  }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-customer',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Customer },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);

    await page.goto('/edit-users');
    await expect(
      page.getByTestId('not-allowed-page')
    ).toBeVisible({ timeout: 20000 });

    await page.goto('/all-inventory');
    await expect(
      page.getByTestId('not-allowed-page')
    ).toBeVisible({ timeout: 20000 });
  });

  test('admin sees all 11 nav items and can navigate to each', async ({
    page,
    request,
  }, testInfo) => {
    testInfo.setTimeout(120_000);
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await openSideNav(page);

    const allAdminRoutes = [
      'my-items',
      'today-report',
      'reports-history',
      'edit-products',
      'edit-users',
      'all-inventory',
      'inventory-by-users',
      'add-inventory',
      'remove-inventory',
      'create-form',
      'forms',
    ];

    for (const route of allAdminRoutes) {
      await expect(page.getByTestId(`nav-link-${route}`)).toBeVisible({
        timeout: 10000,
      });
    }

    await expect(
      page.getByTestId('nav-link-my-forms')
    ).not.toBeAttached();
  });
});
