import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { InventoryItem, UserRole } from '@equip-track/shared';
import { mintE2eJwt } from './helpers/e2e-auth';
import {
  E2E_LANGUAGE_STORAGE_KEY,
  E2E_TEST_APP_LANGUAGE,
} from './helpers/e2e-locale';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';
const organizationId = 'org-e2e-main';
const customerUserId = 'user-e2e-customer';
const warehouseUserId = 'WAREHOUSE';

const bulkProductId = 'prod-bulk-helmet';
const upiProductId = 'prod-upi-laptop';
const transferredBulkQuantity = 2;

interface InventoryResponse {
  status: boolean;
  items: InventoryItem[];
}

async function getInventory(
  request: APIRequestContext,
  token: string,
  userId: string
): Promise<InventoryItem[]> {
  const response = await request.get(
    `${backendBaseUrl}/api/organizations/${organizationId}/inventory/user/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as InventoryResponse;
  expect(payload.status).toBeTruthy();
  return payload.items;
}

function getItem(items: InventoryItem[], productId: string): InventoryItem {
  const item = items.find((inventoryItem) => inventoryItem.productId === productId);
  if (!item) {
    throw new Error(`Missing inventory item for product ${productId}`);
  }
  return item;
}

async function bootstrapAuthenticatedSession(page: Page, token: string) {
  await page.addInitScript(
    ({
      jwt,
      selectedOrganizationId,
      languageKey,
      languageValue,
    }: {
      jwt: string;
      selectedOrganizationId: string;
      languageKey: string;
      languageValue: string;
    }) => {
      window.localStorage.setItem('equip-track-token', jwt);
      window.localStorage.setItem(
        'equip-track-selected-org',
        selectedOrganizationId
      );
      window.localStorage.setItem(languageKey, languageValue);
    },
    {
      jwt: token,
      selectedOrganizationId: organizationId,
      languageKey: E2E_LANGUAGE_STORAGE_KEY,
      languageValue: E2E_TEST_APP_LANGUAGE,
    }
  );
}

async function ensureOrganizationIsSelected(page: Page): Promise<void> {
  await page.goto('/');

  const selectBtn = page.getByTestId(`select-organization-${organizationId}`);

  // Org picker may still be loading (spinner disables the button). Wait before
  // deciding we need a manual click.
  const orgPickerShown = await selectBtn
    .waitFor({ state: 'visible', timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  if (orgPickerShown) {
    await expect(selectBtn).toBeEnabled({ timeout: 20000 });
    await selectBtn.click();
  }

  // HomeComponent defers router.navigate after select with setTimeout(100).
  // If we navigate to /create-form before that runs, the guard can strand us on /.
  await expect(page).toHaveURL(/\/my-items/, { timeout: 20000 });
}

/** Client-side nav: avoids `page.goto` full reload (org selection / APP_INITIALIZER race). */
async function clickSideNavRoute(page: Page, route: string): Promise<void> {
  const link = page.getByTestId(`nav-link-${route}`);
  await link.waitFor({ state: 'attached', timeout: 20000 });
  await link.evaluate((el: HTMLElement) => el.click());

  const leaveUnsaved = page.getByRole('button', { name: /^Leave$/i });
  try {
    await leaveUnsaved.waitFor({ state: 'visible', timeout: 4000 });
    await leaveUnsaved.click();
  } catch {
    // No unsaved-changes dialog (e.g. navigating from my-items)
  }
}

async function openCreateFormPage(page: Page): Promise<void> {
  const createFormPage = page.getByTestId('create-form-page');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    // Full page loads (page.goto) re-run APP_INITIALIZER; a tight race can leave
    // selectedOrganizationId unset before guards run. Side-nav routerLink keeps the
    // SPA session and store intact once we are on /my-items.
    const orgPicker = page.getByTestId('organization-selection-page');
    const onOrgPicker =
      (await orgPicker.count()) > 0 &&
      (await orgPicker.first().isVisible().catch(() => false));

    if (onOrgPicker) {
      const selectBtn = page.getByTestId(`select-organization-${organizationId}`);
      await expect(selectBtn).toBeEnabled({ timeout: 20000 });
      await selectBtn.click();
      await expect(page).toHaveURL(/\/my-items/, { timeout: 20000 });
    }

    await clickSideNavRoute(page, 'create-form');

    try {
      await createFormPage.waitFor({ state: 'visible', timeout: 10000 });
      return;
    } catch {
      // Retry after recovery paths below
    }

    if (await page.getByTestId('login-page').isVisible().catch(() => false)) {
      throw new Error(
        'Unexpected redirect to login while opening create-form page'
      );
    }
  }

  await expect(createFormPage).toBeVisible({
    timeout: 15000,
  });
}

async function fillInventoryRow(
  page: Page,
  rowIndex: number,
  productId: string,
  quantity: number
) {
  const row = page.getByTestId('editable-item-row').nth(rowIndex);
  await row.getByTestId('editable-item-product-input').click();
  await row.getByTestId('editable-item-product-input').fill(productId);
  await page
    .locator(`[data-testid="editable-item-product-option-${productId}"]`)
    .first()
    .click();

  await row.getByTestId('editable-item-quantity-input').fill(String(quantity));
}

async function approveLatestPendingForm(page: Page, description: string) {
  const formCard = page
    .locator('[data-testid^="form-card-"]')
    .filter({ hasText: description })
    .first();
  await expect(formCard).toBeVisible({ timeout: 20000 });

  await formCard.locator('[data-testid^="form-approve-"]').click();

  const signatureCanvas = page.getByTestId('signature-pad-canvas');
  await expect(signatureCanvas).toBeVisible();

  const box = await signatureCanvas.boundingBox();
  if (!box) {
    throw new Error('Unable to draw signature: canvas has no bounding box');
  }

  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 100);
  await page.mouse.up();

  const signatureOk = page.getByTestId('signature-dialog-approve');
  await expect(signatureOk).toBeEnabled({ timeout: 10000 });

  const approveRequest = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.url().includes('/forms/approve') &&
      r.ok(),
    { timeout: 30000 }
  );
  await signatureOk.click();
  await approveRequest;

  // Default forms view is "Pending"; approved forms drop out of that filter.
  await page.getByTestId('forms-status-filter').click();
  await page.locator('mat-option[value="all"]').click();

  const cardAfterApprove = page
    .locator('[data-testid^="form-card-"]')
    .filter({ hasText: description })
    .first();
  await expect(
    cardAfterApprove.locator('[data-testid^="form-status-"]')
  ).toHaveClass('approved', { timeout: 30000 });
}

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
        [organizationId]: UserRole.Admin,
      },
    });

    const beforeWarehouseInventory = await getInventory(
      request,
      adminToken,
      warehouseUserId
    );
    const beforeCustomerInventory = await getInventory(
      request,
      adminToken,
      customerUserId
    );

    const beforeWarehouseBulk = getItem(beforeWarehouseInventory, bulkProductId);
    const beforeCustomerBulk = getItem(beforeCustomerInventory, bulkProductId);
    const beforeWarehouseUpi = getItem(beforeWarehouseInventory, upiProductId);
    const beforeCustomerUpi = getItem(beforeCustomerInventory, upiProductId);
    const transferredUpi = beforeWarehouseUpi.upis?.[0];
    expect(transferredUpi).toBeTruthy();

    await bootstrapAuthenticatedSession(page, adminToken);
    await ensureOrganizationIsSelected(page);

    const checkoutDescription = `e2e ui checkout ${Date.now()}`;

    const warehouseInventoryResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().includes(`inventory/user/${warehouseUserId}`) &&
        r.ok(),
      { timeout: 30000 }
    );
    await openCreateFormPage(page);
    try {
      await warehouseInventoryResponse;
    } catch {
      // GET may have completed before the listener was registered (e.g. cached store).
    }
    const whAtFormOpen = await getInventory(
      request,
      adminToken,
      warehouseUserId
    );
    const laptopAtFormOpen = getItem(whAtFormOpen, upiProductId);
    expect(laptopAtFormOpen.upis || []).toContain(transferredUpi);

    await page.getByTestId('create-form-user-select').click();
    await page.getByTestId(`create-form-user-option-${customerUserId}`).click();
    await page
      .getByTestId('create-form-description-input')
      .fill(checkoutDescription);

    await fillInventoryRow(page, 0, bulkProductId, transferredBulkQuantity);
    await page.getByTestId('editable-inventory-add-item').click();
    await fillInventoryRow(page, 1, upiProductId, 1);
    // UPI fields sit in a sibling block under `editable-item` (not inside `editable-item-row`).
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

    const afterWarehouseInventory = await getInventory(
      request,
      adminToken,
      warehouseUserId
    );
    const afterCustomerInventory = await getInventory(
      request,
      adminToken,
      customerUserId
    );

    const afterWarehouseBulk = getItem(afterWarehouseInventory, bulkProductId);
    const afterCustomerBulk = getItem(afterCustomerInventory, bulkProductId);
    const afterWarehouseUpi = getItem(afterWarehouseInventory, upiProductId);
    const afterCustomerUpi = getItem(afterCustomerInventory, upiProductId);

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
});
