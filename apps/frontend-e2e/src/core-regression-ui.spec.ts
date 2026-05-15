import { expect, test } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from './helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
  ensureInspectorLandsOnReportsHistory,
  clickSideNavRoute,
  openCreateFormPage,
  fillInventoryRow,
  approveLatestPendingForm,
} from './helpers/e2e-navigation';
import {
  getUserInventory,
  itemByProductId,
  E2E_ORG_ID,
  E2E_CUSTOMER_USER_ID,
  E2E_BULK_PRODUCT_ID,
  E2E_UPI_PRODUCT_ID,
} from './helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

const warehouseUserId = 'WAREHOUSE';
const transferredBulkQuantity = 2;

test.describe('core regression ui flow', () => {
  test('create and approve checkout via UI updates inventory', async ({
    page,
    request,
  }, testInfo) => {
    testInfo.setTimeout(120_000);
    const adminToken = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: {
        [E2E_ORG_ID]: UserRole.Admin,
      },
    });

    const beforeWarehouseInventory = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      warehouseUserId
    );
    const beforeCustomerInventory = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      E2E_CUSTOMER_USER_ID
    );

    const beforeWarehouseBulk = itemByProductId(beforeWarehouseInventory, E2E_BULK_PRODUCT_ID);
    const beforeCustomerBulk = itemByProductId(beforeCustomerInventory, E2E_BULK_PRODUCT_ID);
    const beforeWarehouseUpi = itemByProductId(beforeWarehouseInventory, E2E_UPI_PRODUCT_ID);
    const beforeCustomerUpi = itemByProductId(beforeCustomerInventory, E2E_UPI_PRODUCT_ID);
    const transferredUpi = beforeWarehouseUpi.upis?.[0];
    expect(transferredUpi).toBeTruthy();

    await bootstrapAuthenticatedSession(page, adminToken, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);

    const checkoutDescription = `e2e ui checkout ${Date.now()}`;

    const warehouseInventoryResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().includes(`inventory/user/${warehouseUserId}`) &&
        r.ok(),
      { timeout: 30000 }
    );
    await openCreateFormPage(page, E2E_ORG_ID);
    try {
      await warehouseInventoryResponse;
    } catch {
      // GET may have completed before the listener was registered (e.g. cached store).
    }
    const whAtFormOpen = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      warehouseUserId
    );
    const laptopAtFormOpen = itemByProductId(whAtFormOpen, E2E_UPI_PRODUCT_ID);
    expect(laptopAtFormOpen.upis || []).toContain(transferredUpi);

    const userSelect = page.getByTestId('create-form-user-select');
    await userSelect.locator('.ng-select-container').click();
    const filterInput = userSelect.locator('.ng-input input');
    await expect(filterInput).toBeVisible({ timeout: 15000 });
    await filterInput.fill('E2E Customer');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page
      .getByTestId('create-form-description-input')
      .fill(checkoutDescription);

    await fillInventoryRow(page, 0, E2E_BULK_PRODUCT_ID, transferredBulkQuantity);
    await page.getByTestId('editable-inventory-add-item').click();
    await fillInventoryRow(page, 1, E2E_UPI_PRODUCT_ID, 1);
    const laptopEditableItem = page.locator('editable-item').nth(1);
    await expect(
      laptopEditableItem.getByTestId('editable-item-upis-section')
    ).toBeVisible({ timeout: 15000 });
    const laptopUpiInput = laptopEditableItem.getByTestId(
      'editable-item-upi-input-0'
    );
    await laptopUpiInput.fill(transferredUpi!);
    await laptopUpiInput.blur();

    const submitCheckout = page.getByTestId('editable-inventory-submit');
    await expect(submitCheckout).toBeEnabled({ timeout: 30000 });
    await submitCheckout.click();

    await clickSideNavRoute(page, 'forms');
    await expect(page.getByTestId('forms-tab-group')).toBeVisible({
      timeout: 15000,
    });
    await approveLatestPendingForm(page, checkoutDescription);

    const afterWarehouseInventory = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      warehouseUserId
    );
    const afterCustomerInventory = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      E2E_CUSTOMER_USER_ID
    );

    const afterWarehouseBulk = itemByProductId(afterWarehouseInventory, E2E_BULK_PRODUCT_ID);
    const afterCustomerBulk = itemByProductId(afterCustomerInventory, E2E_BULK_PRODUCT_ID);
    const afterWarehouseUpi = itemByProductId(afterWarehouseInventory, E2E_UPI_PRODUCT_ID);
    const afterCustomerUpi = itemByProductId(afterCustomerInventory, E2E_UPI_PRODUCT_ID);

    expect(afterWarehouseBulk.quantity).toBe(
      beforeWarehouseBulk.quantity - transferredBulkQuantity
    );
    expect(afterCustomerBulk.quantity).toBe(
      beforeCustomerBulk.quantity + transferredBulkQuantity
    );

    expect(afterWarehouseUpi.upis || []).not.toContain(transferredUpi);
    expect(afterCustomerUpi.upis || []).toEqual(
      expect.arrayContaining([...(beforeCustomerUpi.upis || []), transferredUpi])
    );
  });

  test('inspector lands on report history and cannot access restricted routes', async ({
    page,
    request,
  }) => {
    const inspectorToken = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-inspector',
      orgIdToRole: {
        [E2E_ORG_ID]: UserRole.Inspector,
      },
    });

    await bootstrapAuthenticatedSession(page, inspectorToken, E2E_ORG_ID);
    await ensureInspectorLandsOnReportsHistory(page, E2E_ORG_ID);

    await expect(page.getByRole('heading', { name: 'Reports History' })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByTestId('nav-link-reports-history')).toHaveCount(1);
    await expect(page.getByTestId('nav-link-my-items')).toHaveCount(0);
    await expect(page.getByTestId('nav-link-create-form')).toHaveCount(0);
    await expect(page.getByTestId('nav-link-forms')).toHaveCount(0);

    await page.goto('/my-items');
    await expect(page).toHaveURL(/\/not-allowed/, { timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
  });
});
