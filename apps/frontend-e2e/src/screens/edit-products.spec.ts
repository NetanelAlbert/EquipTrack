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

test.describe('edit-products screen', () => {
  test('loads existing seeded products', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'edit-products');
    await waitForTestId(page, 'edit-products-page');

    await expect(
      page.getByTestId(`edit-products-card-${E2E_BULK_PRODUCT_ID}`)
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByTestId(`edit-products-card-${E2E_UPI_PRODUCT_ID}`)
    ).toBeVisible();
  });

  test('create a new product', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(60_000);
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    const newProductId = `prod-e2e-${Date.now()}`;
    const newProductName = `E2E Test Product ${Date.now()}`;

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'edit-products');
    await waitForTestId(page, 'edit-products-page');

    await page.getByTestId('edit-products-id-input').fill(newProductId);
    await page.getByTestId('edit-products-name-input').fill(newProductName);
    await page.getByTestId('edit-products-upi-checkbox').click();

    const saveBtn = page.getByTestId('edit-products-save-btn');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    await expect(
      page.getByTestId(`edit-products-card-${newProductId}`)
    ).toBeVisible({ timeout: 20000 });
  });

  test('search filters products', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'edit-products');
    await waitForTestId(page, 'edit-products-page');

    await expect(
      page.getByTestId(`edit-products-card-${E2E_BULK_PRODUCT_ID}`)
    ).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByTestId('edit-products-search');
    await searchInput.fill('Helmet');

    await expect(
      page.getByTestId(`edit-products-card-${E2E_BULK_PRODUCT_ID}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`edit-products-card-${E2E_UPI_PRODUCT_ID}`)
    ).not.toBeVisible();
  });

  test('filter by UPI/non-UPI', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'edit-products');
    await waitForTestId(page, 'edit-products-page');

    await expect(
      page.getByTestId(`edit-products-card-${E2E_BULK_PRODUCT_ID}`)
    ).toBeVisible({ timeout: 15000 });

    const filterGroup = page.getByTestId('edit-products-filter');
    await filterGroup.locator('mat-radio-button[value="upi"]').click();
    await expect(
      page.getByTestId(`edit-products-card-${E2E_UPI_PRODUCT_ID}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`edit-products-card-${E2E_BULK_PRODUCT_ID}`)
    ).not.toBeVisible();

    await filterGroup.locator('mat-radio-button[value="no-upi"]').click();
    await expect(
      page.getByTestId(`edit-products-card-${E2E_BULK_PRODUCT_ID}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`edit-products-card-${E2E_UPI_PRODUCT_ID}`)
    ).not.toBeVisible();
  });

  test('unsaved changes guard when form is dirty', async ({
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
    await clickSideNavRoute(page, 'edit-products');
    await waitForTestId(page, 'edit-products-page');

    await page.getByTestId('edit-products-id-input').fill('dirty-product');

    const navLink = page.getByTestId('nav-link-my-items');
    await navLink.waitFor({ state: 'attached', timeout: 10000 });
    await navLink.evaluate((el: HTMLElement) => el.click());

    const leaveBtn = page.getByRole('button', { name: /^Leave$/i });
    await expect(leaveBtn).toBeVisible({ timeout: 8000 });

    const stayBtn = page.getByRole('button', { name: /^Stay$/i });
    await stayBtn.click();

    await expect(page.getByTestId('edit-products-page')).toBeVisible();
  });
});
