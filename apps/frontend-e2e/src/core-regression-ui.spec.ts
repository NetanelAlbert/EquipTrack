import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { InventoryItem, UserRole } from '@equip-track/shared';
import { mintE2eJwt } from './helpers/e2e-auth';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';
const organizationId = 'org-e2e-main';
const customerUserId = 'user-e2e-customer';
const warehouseUserId = 'WAREHOUSE';

const bulkProductId = 'prod-bulk-helmet';
const upiProductId = 'prod-upi-laptop';
const transferredUpi = 'LAP-WH-001';
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
    }: {
      jwt: string;
      selectedOrganizationId: string;
    }) => {
      window.localStorage.setItem('equip-track-token', jwt);
      window.localStorage.setItem(
        'equip-track-selected-org',
        selectedOrganizationId
      );
    },
    {
      jwt: token,
      selectedOrganizationId: organizationId,
    }
  );
}

async function ensureOrganizationIsSelected(page: Page): Promise<void> {
  await page.goto('/');

  const orgSelectionPage = page.getByTestId('organization-selection-page');

  if (await orgSelectionPage.isVisible()) {
    await page.getByTestId(`select-organization-${organizationId}`).click();
  }
}

async function openCreateFormPage(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/create-form');

    const createFormVisible = await page
      .getByTestId('create-form-page')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (createFormVisible) {
      return;
    }

    const loginVisible = await page
      .getByTestId('login-page')
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (loginVisible) {
      throw new Error(
        'Unexpected redirect to login while opening create-form page'
      );
    }

    const orgSelectionVisible = await page
      .getByTestId('organization-selection-page')
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (orgSelectionVisible) {
      await page.getByTestId(`select-organization-${organizationId}`).click();
      await page.waitForTimeout(500);
    }
  }

  await expect(page.getByTestId('create-form-page')).toBeVisible({
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
  await expect(formCard).toBeVisible();

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

  await page.getByTestId('signature-dialog-approve').click();
  await expect(formCard.locator('[data-testid^="form-status-"]')).toContainText(
    /approved/i
  );
}

test.describe('core regression ui flow', () => {
  test('create and approve checkout via UI updates inventory', async ({
    page,
    request,
  }) => {
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

    await bootstrapAuthenticatedSession(page, adminToken);
    await ensureOrganizationIsSelected(page);

    const checkoutDescription = `e2e ui checkout ${Date.now()}`;

    await openCreateFormPage(page);

    await page.getByTestId('create-form-user-select').click();
    await page.getByTestId(`create-form-user-option-${customerUserId}`).click();
    await page
      .getByTestId('create-form-description-input')
      .fill(checkoutDescription);

    await fillInventoryRow(page, 0, bulkProductId, transferredBulkQuantity);
    await page.getByTestId('editable-inventory-add-item').click();
    await fillInventoryRow(page, 1, upiProductId, 1);
    await page.getByTestId('editable-item-upi-input-0').last().fill(transferredUpi);

    await page.getByTestId('editable-inventory-submit').click();

    await page.goto('/forms');
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

    expect(beforeWarehouseUpi.upis || []).toContain(transferredUpi);
    expect(afterWarehouseUpi.upis || []).not.toContain(transferredUpi);
    expect(afterCustomerUpi.upis || []).toEqual(
      expect.arrayContaining([...(beforeCustomerUpi.upis || []), transferredUpi])
    );
  });
});
