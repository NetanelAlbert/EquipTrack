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
  E2E_UPI_PRODUCT_ID,
  getUserInventory,
  itemByProductId,
} from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test.describe('add-inventory screen', () => {
  test('add bulk inventory updates warehouse quantity', async ({
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

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'add-inventory');
    await waitForTestId(page, 'add-inventory-page');

    await fillInventoryRow(page, 0, E2E_BULK_PRODUCT_ID, 5);
    const submitBtn = page.getByTestId('editable-inventory-submit');
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });

    const addResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/inventory') &&
        r.status() < 400,
      { timeout: 30000 }
    );
    await submitBtn.click();
    await addResponse;

    await expect(page).toHaveURL(/\/all-inventory/, { timeout: 30000 });

    const afterInventory = await getUserInventory(
      request,
      token,
      E2E_ORG_ID,
      'WAREHOUSE'
    );
    const afterBulk = itemByProductId(afterInventory, E2E_BULK_PRODUCT_ID);
    expect(afterBulk.quantity).toBe(beforeBulk.quantity + 5);
  });

  test('add UPI inventory to warehouse', async ({
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

    const upiSerial = `E2E-ADD-${Date.now()}`;

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'add-inventory');
    await waitForTestId(page, 'add-inventory-page');

    await fillInventoryRow(page, 0, E2E_UPI_PRODUCT_ID, 1);

    const editableItem = page.locator('editable-item').first();
    await expect(
      editableItem.getByTestId('editable-item-upis-section')
    ).toBeVisible({ timeout: 15000 });
    const upiInput = editableItem.getByTestId('editable-item-upi-input-0');
    await upiInput.fill(upiSerial);
    await upiInput.blur();

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
    const afterUpi = itemByProductId(afterInventory, E2E_UPI_PRODUCT_ID);
    expect(afterUpi.upis || []).toContain(upiSerial);
  });

  test('cancel navigates to all-inventory without changes', async ({
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
    await clickSideNavRoute(page, 'add-inventory');
    await waitForTestId(page, 'add-inventory-page');

    await page.getByTestId('add-inventory-cancel').click();
    await expect(page).toHaveURL(/\/all-inventory/, { timeout: 20000 });
  });

  test('unsaved changes guard when items are edited', async ({
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
    await clickSideNavRoute(page, 'add-inventory');
    await waitForTestId(page, 'add-inventory-page');

    await fillInventoryRow(page, 0, E2E_BULK_PRODUCT_ID, 1);
    await page.waitForTimeout(500);

    const navLink = page.getByTestId('nav-link-my-items');
    await navLink.waitFor({ state: 'attached', timeout: 10000 });
    await navLink.evaluate((el: HTMLElement) => el.click());

    const leaveBtn = page.getByRole('button', { name: /^Leave$/i });
    await expect(leaveBtn).toBeVisible({ timeout: 8000 });

    const stayBtn = page.getByRole('button', { name: /^Stay$/i });
    await stayBtn.click();

    await expect(page.getByTestId('add-inventory-page')).toBeVisible();
  });
});
