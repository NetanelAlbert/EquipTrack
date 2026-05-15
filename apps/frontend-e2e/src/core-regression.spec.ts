import { test, expect } from '@playwright/test';
import { FormType, UserRole } from '@equip-track/shared';
import { mintE2eJwt } from './helpers/e2e-auth';
import {
  getUserInventory,
  createForm,
  approveForm,
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

test.describe('core regression inventory transfer flow', () => {
  test('checkout and checkin (bulk + UPI) update warehouse and user quantities', async ({
    request,
  }) => {
    const adminToken = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: {
        [E2E_ORG_ID]: UserRole.Admin,
      },
    });

    const initialWarehouseInventory = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      warehouseUserId
    );
    const initialCustomerInventory = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      E2E_CUSTOMER_USER_ID
    );

    const initialWarehouseBulk = itemByProductId(initialWarehouseInventory, E2E_BULK_PRODUCT_ID);
    const initialCustomerBulk = itemByProductId(initialCustomerInventory, E2E_BULK_PRODUCT_ID);
    const initialWarehouseUpi = itemByProductId(initialWarehouseInventory, E2E_UPI_PRODUCT_ID);
    const initialCustomerUpi = itemByProductId(initialCustomerInventory, E2E_UPI_PRODUCT_ID);

    const transferredUpi = initialWarehouseUpi.upis?.[0];
    expect(transferredUpi).toBeTruthy();
    const transferQuantity = 2;

    const checkoutForm = await createForm(request, adminToken, E2E_ORG_ID, {
      formType: FormType.CheckOut,
      userId: E2E_CUSTOMER_USER_ID,
      items: [
        { productId: E2E_BULK_PRODUCT_ID, quantity: transferQuantity },
        { productId: E2E_UPI_PRODUCT_ID, quantity: 1, upis: [transferredUpi as string] },
      ],
      description: 'e2e checkout regression',
    });
    await approveForm(request, adminToken, E2E_ORG_ID, checkoutForm.formID, checkoutForm.userID);

    const postCheckoutWarehouseInventory = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      warehouseUserId
    );
    const postCheckoutCustomerInventory = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      E2E_CUSTOMER_USER_ID
    );

    const postCheckoutWarehouseBulk = itemByProductId(postCheckoutWarehouseInventory, E2E_BULK_PRODUCT_ID);
    const postCheckoutCustomerBulk = itemByProductId(postCheckoutCustomerInventory, E2E_BULK_PRODUCT_ID);
    const postCheckoutWarehouseUpi = itemByProductId(postCheckoutWarehouseInventory, E2E_UPI_PRODUCT_ID);
    const postCheckoutCustomerUpi = itemByProductId(postCheckoutCustomerInventory, E2E_UPI_PRODUCT_ID);

    expect(postCheckoutWarehouseBulk.quantity).toBe(
      initialWarehouseBulk.quantity - transferQuantity
    );
    expect(postCheckoutCustomerBulk.quantity).toBe(
      initialCustomerBulk.quantity + transferQuantity
    );
    expect(postCheckoutWarehouseUpi.upis || []).not.toContain(transferredUpi);
    expect(postCheckoutCustomerUpi.upis || []).toContain(transferredUpi);

    const checkinForm = await createForm(request, adminToken, E2E_ORG_ID, {
      formType: FormType.CheckIn,
      userId: E2E_CUSTOMER_USER_ID,
      items: [
        { productId: E2E_BULK_PRODUCT_ID, quantity: transferQuantity },
        { productId: E2E_UPI_PRODUCT_ID, quantity: 1, upis: [transferredUpi as string] },
      ],
      description: 'e2e checkin regression',
    });
    await approveForm(request, adminToken, E2E_ORG_ID, checkinForm.formID, checkinForm.userID);

    const finalWarehouseInventory = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      warehouseUserId
    );
    const finalCustomerInventory = await getUserInventory(
      request,
      adminToken,
      E2E_ORG_ID,
      E2E_CUSTOMER_USER_ID
    );

    const finalWarehouseBulk = itemByProductId(finalWarehouseInventory, E2E_BULK_PRODUCT_ID);
    const finalCustomerBulk = itemByProductId(finalCustomerInventory, E2E_BULK_PRODUCT_ID);
    const finalWarehouseUpi = itemByProductId(finalWarehouseInventory, E2E_UPI_PRODUCT_ID);
    const finalCustomerUpi = itemByProductId(finalCustomerInventory, E2E_UPI_PRODUCT_ID);

    expect(finalWarehouseBulk.quantity).toBe(initialWarehouseBulk.quantity);
    expect(finalCustomerBulk.quantity).toBe(initialCustomerBulk.quantity);
    expect(finalWarehouseUpi.upis || []).toContain(transferredUpi);
    expect(finalCustomerUpi.upis || []).toEqual(
      expect.arrayContaining(initialCustomerUpi.upis || [])
    );
    expect(finalCustomerUpi.upis || []).not.toContain(transferredUpi);
  });
});

test.describe('inspector role api access', () => {
  test('can read reports history endpoint and is blocked from inventory management endpoint', async ({
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

    const reportHistoryResponse = await request.post(
      `${backendBaseUrl}/api/organizations/${E2E_ORG_ID}/reports/by-dates`,
      {
        headers: {
          Authorization: `Bearer ${inspectorToken}`,
        },
        data: {
          dates: ['2025-01-01'],
        },
      }
    );
    expect(reportHistoryResponse.ok()).toBeTruthy();
    const reportHistoryPayload = (await reportHistoryResponse.json()) as {
      status: boolean;
      reportsByDate: Record<string, unknown[]>;
    };
    expect(reportHistoryPayload.status).toBeTruthy();
    expect(reportHistoryPayload.reportsByDate).toBeDefined();

    const inventoryResponse = await request.get(
      `${backendBaseUrl}/api/organizations/${E2E_ORG_ID}/inventory`,
      {
        headers: {
          Authorization: `Bearer ${inspectorToken}`,
        },
      }
    );
    expect(inventoryResponse.status()).toBe(403);
  });
});
