import { test, expect } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from '../helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
  clickSideNavRoute,
  waitForTestId,
} from '../helpers/e2e-navigation';
import { E2E_ORG_ID, E2E_BULK_PRODUCT_ID, E2E_UPI_PRODUCT_ID } from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test.describe('all-inventory screen', () => {
  test('loads total inventory with seeded products', async ({
    page,
    request,
  }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'all-inventory');

    await waitForTestId(page, 'all-inventory-page');

    const list = page.getByTestId('all-inventory-list');
    await expect(list).toBeVisible({ timeout: 20000 });

    const listText = await list.textContent();
    expect(listText).toContain(E2E_BULK_PRODUCT_ID);
    expect(listText).toContain(E2E_UPI_PRODUCT_ID);
  });

  test('search filters inventory items', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'all-inventory');
    await waitForTestId(page, 'all-inventory-page');
    await expect(page.getByTestId('all-inventory-list')).toBeVisible({
      timeout: 20000,
    });

    const searchField = page
      .getByTestId('all-inventory-search')
      .locator('input');
    await searchField.fill('Helmet');
    await expect(page.getByTestId('all-inventory-list')).toContainText(
      E2E_BULK_PRODUCT_ID
    );

    await searchField.fill('nonexistent-product-xyz');
    await expect(page.getByTestId('all-inventory-list')).not.toContainText(
      E2E_BULK_PRODUCT_ID
    );
  });

  test('customer cannot access all-inventory', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-customer',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Customer },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await page.goto('/all-inventory');

    await expect(
      page.getByTestId('not-allowed-page')
    ).toBeVisible({ timeout: 20000 });
  });
});
