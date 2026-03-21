import { test, expect, APIRequestContext } from '@playwright/test';
import { FormType, InventoryItem, UserRole } from '@equip-track/shared';
import { mintE2eJwt } from './helpers/e2e-auth';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';
const organizationId = 'org-e2e-main';
const customerUserId = 'user-e2e-customer';
const warehouseUserId = 'WAREHOUSE';
const bulkProductId = 'prod-bulk-helmet';
const upiProductId = 'prod-upi-laptop';

interface GetInventoryResponse {
  status: boolean;
  items: InventoryItem[];
}

interface CreateFormResponse {
  status: boolean;
  form: {
    formID: string;
    userID: string;
  };
}

async function getUserInventory(
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
  const payload = (await response.json()) as GetInventoryResponse;
  expect(payload.status).toBeTruthy();
  return payload.items;
}

function itemByProductId(items: InventoryItem[], productId: string): InventoryItem {
  const item = items.find((inventoryItem) => inventoryItem.productId === productId);
  if (!item) {
    throw new Error(`Missing inventory item for product ${productId}`);
  }
  return item;
}

async function createForm(
  request: APIRequestContext,
  token: string,
  formType: FormType,
  items: InventoryItem[],
  description: string
): Promise<{ formID: string; userID: string }> {
  const response = await request.post(
    `${backendBaseUrl}/api/organizations/${organizationId}/forms/create`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        formType,
        userId: customerUserId,
        items,
        description,
      },
    }
  );
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as CreateFormResponse;
  expect(payload.status).toBeTruthy();
  return payload.form;
}

async function approveForm(
  request: APIRequestContext,
  token: string,
  formID: string,
  userId: string
): Promise<void> {
  const response = await request.post(
    `${backendBaseUrl}/api/organizations/${organizationId}/forms/approve`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        formID,
        userId,
        signature:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAnUBq4qzM7cAAAAASUVORK5CYII=',
      },
    }
  );
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { status: boolean };
  expect(payload.status).toBeTruthy();
}

test.describe('core regression inventory transfer flow', () => {
  test('checkout and checkin (bulk + UPI) update warehouse and user quantities', async ({
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

    const initialWarehouseInventory = await getUserInventory(
      request,
      adminToken,
      warehouseUserId
    );
    const initialCustomerInventory = await getUserInventory(
      request,
      adminToken,
      customerUserId
    );

    const initialWarehouseBulk = itemByProductId(
      initialWarehouseInventory,
      bulkProductId
    );
    const initialCustomerBulk = itemByProductId(
      initialCustomerInventory,
      bulkProductId
    );
    const initialWarehouseUpi = itemByProductId(
      initialWarehouseInventory,
      upiProductId
    );
    const initialCustomerUpi = itemByProductId(initialCustomerInventory, upiProductId);

    const transferredUpi = initialWarehouseUpi.upis?.[0];
    expect(transferredUpi).toBeTruthy();
    const transferQuantity = 2;
    const transferItems: InventoryItem[] = [
      {
        productId: bulkProductId,
        quantity: transferQuantity,
      },
      {
        productId: upiProductId,
        quantity: 1,
        upis: [transferredUpi as string],
      },
    ];

    const checkoutForm = await createForm(
      request,
      adminToken,
      FormType.CheckOut,
      transferItems,
      'e2e checkout regression'
    );
    await approveForm(request, adminToken, checkoutForm.formID, checkoutForm.userID);

    const postCheckoutWarehouseInventory = await getUserInventory(
      request,
      adminToken,
      warehouseUserId
    );
    const postCheckoutCustomerInventory = await getUserInventory(
      request,
      adminToken,
      customerUserId
    );

    const postCheckoutWarehouseBulk = itemByProductId(
      postCheckoutWarehouseInventory,
      bulkProductId
    );
    const postCheckoutCustomerBulk = itemByProductId(
      postCheckoutCustomerInventory,
      bulkProductId
    );
    const postCheckoutWarehouseUpi = itemByProductId(
      postCheckoutWarehouseInventory,
      upiProductId
    );
    const postCheckoutCustomerUpi = itemByProductId(
      postCheckoutCustomerInventory,
      upiProductId
    );

    expect(postCheckoutWarehouseBulk.quantity).toBe(
      initialWarehouseBulk.quantity - transferQuantity
    );
    expect(postCheckoutCustomerBulk.quantity).toBe(
      initialCustomerBulk.quantity + transferQuantity
    );
    expect(postCheckoutWarehouseUpi.upis || []).not.toContain(transferredUpi);
    expect(postCheckoutCustomerUpi.upis || []).toContain(transferredUpi);

    const checkinForm = await createForm(
      request,
      adminToken,
      FormType.CheckIn,
      transferItems,
      'e2e checkin regression'
    );
    await approveForm(request, adminToken, checkinForm.formID, checkinForm.userID);

    const finalWarehouseInventory = await getUserInventory(
      request,
      adminToken,
      warehouseUserId
    );
    const finalCustomerInventory = await getUserInventory(
      request,
      adminToken,
      customerUserId
    );

    const finalWarehouseBulk = itemByProductId(finalWarehouseInventory, bulkProductId);
    const finalCustomerBulk = itemByProductId(finalCustomerInventory, bulkProductId);
    const finalWarehouseUpi = itemByProductId(finalWarehouseInventory, upiProductId);
    const finalCustomerUpi = itemByProductId(finalCustomerInventory, upiProductId);

    expect(finalWarehouseBulk.quantity).toBe(initialWarehouseBulk.quantity);
    expect(finalCustomerBulk.quantity).toBe(initialCustomerBulk.quantity);
    expect(finalWarehouseUpi.upis || []).toContain(transferredUpi);
    expect(finalCustomerUpi.upis || []).toEqual(
      expect.arrayContaining(initialCustomerUpi.upis || [])
    );
    expect(finalCustomerUpi.upis || []).not.toContain(transferredUpi);
  });
});
