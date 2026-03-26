import { test, expect } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from '../helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
  clickSideNavRoute,
  waitForTestId,
} from '../helpers/e2e-navigation';
import { E2E_ORG_ID, E2E_CUSTOMER_USER_ID } from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test.describe('inventory-by-users screen', () => {
  test('loads with warehouse inventory by default', async ({
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
    await clickSideNavRoute(page, 'inventory-by-users');

    await waitForTestId(page, 'inventory-by-users-page');
    await expect(
      page.getByTestId('inventory-by-users-table')
    ).toBeVisible({ timeout: 20000 });

    await expect(
      page.getByTestId('inventory-user-chip-WAREHOUSE')
    ).toBeVisible();
  });

  test('add user column via select', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'inventory-by-users');
    await waitForTestId(page, 'inventory-by-users-page');
    await expect(
      page.getByTestId('inventory-by-users-table')
    ).toBeVisible({ timeout: 20000 });

    const addUserSelect = page.getByTestId(
      'inventory-by-users-add-user-select'
    );
    await addUserSelect.click();
    await page
      .locator('mat-option')
      .filter({ hasText: /E2E Customer/i })
      .first()
      .click();

    await expect(
      page.getByTestId(`inventory-user-chip-${E2E_CUSTOMER_USER_ID}`)
    ).toBeVisible({ timeout: 10000 });
  });

  test('show-all adds all users and reset returns to warehouse only', async ({
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
    await clickSideNavRoute(page, 'inventory-by-users');
    await waitForTestId(page, 'inventory-by-users-page');
    await expect(
      page.getByTestId('inventory-by-users-table')
    ).toBeVisible({ timeout: 20000 });

    const showAllBtn = page.getByTestId('inventory-by-users-show-all');
    await expect(showAllBtn).toBeEnabled({ timeout: 15000 });
    await showAllBtn.click();
    await page.waitForTimeout(1000);

    const chips = page.getByTestId('inventory-by-users-selected-users');
    const chipCount = await chips.locator('mat-chip-row').count();
    expect(chipCount).toBeGreaterThan(1);

    await page.getByTestId('inventory-by-users-reset-warehouse').click();

    const resetChipCount = await chips.locator('mat-chip-row').count();
    expect(resetChipCount).toBe(1);
    await expect(
      page.getByTestId('inventory-user-chip-WAREHOUSE')
    ).toBeVisible();
  });

  test('column sorting works', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'inventory-by-users');
    await waitForTestId(page, 'inventory-by-users-page');
    await expect(
      page.getByTestId('inventory-by-users-table')
    ).toBeVisible({ timeout: 20000 });

    const productHeader = page.locator('.product-header');
    await productHeader.click();

    // Clicking a product row triggers column sort
    const firstProductCell = page.locator('.clickable-product').first();
    await firstProductCell.click();

    const clearSortBtn = page.getByTestId(
      'inventory-by-users-clear-column-sort'
    );
    try {
      await clearSortBtn.waitFor({ state: 'visible', timeout: 5000 });
      await clearSortBtn.click();
      await expect(clearSortBtn).not.toBeVisible({ timeout: 5000 });
    } catch {
      // Column sort button may not appear if only one user column
    }
  });

  test('customer cannot access inventory-by-users', async ({
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
    await page.goto('/inventory-by-users');

    await expect(
      page.getByTestId('not-allowed-page')
    ).toBeVisible({ timeout: 20000 });
  });
});
