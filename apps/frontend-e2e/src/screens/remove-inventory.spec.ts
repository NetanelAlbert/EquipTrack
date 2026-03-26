import { test, expect } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from '../helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
  clickSideNavRoute,
  waitForTestId,
  fillInventoryRow,
} from '../helpers/e2e-navigation';
import {
  E2E_ORG_ID,
  E2E_BULK_PRODUCT_ID,
  getUserInventory,
  itemByProductId,
} from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test.describe('remove-inventory screen', () => {
  test('remove bulk inventory decreases warehouse quantity', async ({
    page,
    request,
  }, testInfo) => {
    testInfo.setTimeout(90_000);
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    const beforeInventory = await getUserInventory(
      request,
      token,
      E2E_ORG_ID,
      'WAREHOUSE'
    );
    const beforeBulk = itemByProductId(beforeInventory, E2E_BULK_PRODUCT_ID);
    const removeQty = 2;

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'remove-inventory');
    await waitForTestId(page, 'remove-inventory-page');

    await fillInventoryRow(page, 0, E2E_BULK_PRODUCT_ID, removeQty);

    const submitBtn = page.getByTestId('editable-inventory-submit');
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();

    await expect(page).toHaveURL(/\/all-inventory/, { timeout: 30000 });

    const afterInventory = await getUserInventory(
      request,
      token,
      E2E_ORG_ID,
      'WAREHOUSE'
    );
    const afterBulk = itemByProductId(afterInventory, E2E_BULK_PRODUCT_ID);
    expect(afterBulk.quantity).toBe(beforeBulk.quantity - removeQty);
  });

  test('unsaved changes guard triggers on navigation', async ({
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
    await clickSideNavRoute(page, 'remove-inventory');
    await waitForTestId(page, 'remove-inventory-page');

    await fillInventoryRow(page, 0, E2E_BULK_PRODUCT_ID, 1);
    await page.waitForTimeout(500);

    const navLink = page.getByTestId('nav-link-my-items');
    await navLink.waitFor({ state: 'attached', timeout: 10000 });
    await navLink.evaluate((el: HTMLElement) => el.click());

    const leaveBtn = page.getByRole('button', { name: /^Leave$/i });
    await expect(leaveBtn).toBeVisible({ timeout: 8000 });

    const stayBtn = page.getByRole('button', { name: /^Stay$/i });
    await stayBtn.click();

    await expect(page.getByTestId('remove-inventory-page')).toBeVisible();
  });

  test('cancel navigates to all-inventory', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'remove-inventory');
    await waitForTestId(page, 'remove-inventory-page');

    await page.getByTestId('remove-inventory-cancel').click();
    await expect(page).toHaveURL(/\/all-inventory/, { timeout: 20000 });
  });
});
