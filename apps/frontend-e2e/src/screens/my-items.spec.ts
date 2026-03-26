import { test, expect } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from '../helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
  waitForTestId,
} from '../helpers/e2e-navigation';
import { E2E_ORG_ID, E2E_BULK_PRODUCT_ID, E2E_UPI_PRODUCT_ID } from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test.describe('my-items screen', () => {
  test('displays customer inventory with seeded items', async ({
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

    await waitForTestId(page, 'my-items-page');
    const list = page.getByTestId('my-items-list');
    await expect(list).toBeVisible({ timeout: 20000 });

    const listText = await list.textContent();
    expect(listText).toContain(E2E_BULK_PRODUCT_ID);
    expect(listText).toContain(E2E_UPI_PRODUCT_ID);
  });

  test('search filters inventory items', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-customer',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Customer },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await waitForTestId(page, 'my-items-page');

    await expect(page.getByTestId('my-items-list')).toBeVisible({
      timeout: 20000,
    });

    const searchField = page
      .getByTestId('my-items-search')
      .locator('input');
    await searchField.fill('Helmet');

    await expect(page.getByTestId('my-items-list')).toContainText(
      E2E_BULK_PRODUCT_ID
    );
  });

  test('admin sees my-items page', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);

    await waitForTestId(page, 'my-items-page');
    await expect(page.getByTestId('my-items-page')).toBeVisible();
  });

  test('navigates to my-items after org selection', async ({
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

    await expect(page).toHaveURL(/\/my-items/, { timeout: 20000 });
  });
});
