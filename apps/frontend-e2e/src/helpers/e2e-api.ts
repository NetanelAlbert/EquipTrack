import { APIRequestContext, expect } from '@playwright/test';
import { FormType, InventoryItem } from '@equip-track/shared';

export const E2E_ORG_ID = 'org-e2e-main';
export const E2E_ADMIN_USER_ID = 'user-e2e-admin';
export const E2E_WAREHOUSE_USER_ID = 'user-e2e-warehouse';
export const E2E_CUSTOMER_USER_ID = 'user-e2e-customer';
export const E2E_INSPECTOR_USER_ID = 'user-e2e-inspector';
export const E2E_BULK_PRODUCT_ID = 'prod-bulk-helmet';
export const E2E_UPI_PRODUCT_ID = 'prod-upi-laptop';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function orgUrl(orgId: string, path: string): string {
  return `${backendBaseUrl}/api/organizations/${orgId}/${path}`;
}

// ─── Inventory ───────────────────────────────────────────

interface GetInventoryResponse {
  status: boolean;
  items: InventoryItem[];
}

export async function getUserInventory(
  request: APIRequestContext,
  token: string,
  orgId: string,
  userId: string
): Promise<InventoryItem[]> {
  const response = await request.get(
    orgUrl(orgId, `inventory/user/${userId}`),
    { headers: authHeaders(token) }
  );
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as GetInventoryResponse;
  expect(payload.status).toBeTruthy();
  return payload.items;
}

export async function getTotalInventory(
  request: APIRequestContext,
  token: string,
  orgId: string
): Promise<InventoryItem[]> {
  const response = await request.get(orgUrl(orgId, 'inventory'), {
    headers: authHeaders(token),
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as GetInventoryResponse;
  expect(payload.status).toBeTruthy();
  return payload.items;
}

export async function addInventory(
  request: APIRequestContext,
  token: string,
  orgId: string,
  items: InventoryItem[]
): Promise<void> {
  const response = await request.post(orgUrl(orgId, 'inventory/add'), {
    headers: authHeaders(token),
    data: { items },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { status: boolean };
  expect(payload.status).toBeTruthy();
}

export async function removeInventory(
  request: APIRequestContext,
  token: string,
  orgId: string,
  items: InventoryItem[]
): Promise<void> {
  const response = await request.post(orgUrl(orgId, 'inventory/remove'), {
    headers: authHeaders(token),
    data: { items },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { status: boolean };
  expect(payload.status).toBeTruthy();
}

// ─── Forms ───────────────────────────────────────────────

interface CreateFormResponse {
  status: boolean;
  form: { formID: string; userID: string };
}

export async function createForm(
  request: APIRequestContext,
  token: string,
  orgId: string,
  payload: {
    formType: FormType;
    userId: string;
    items: InventoryItem[];
    description: string;
  }
): Promise<{ formID: string; userID: string }> {
  const response = await request.post(orgUrl(orgId, 'forms/create'), {
    headers: authHeaders(token),
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as CreateFormResponse;
  expect(body.status).toBeTruthy();
  return body.form;
}

const STUB_SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAnUBq4qzM7cAAAAASUVORK5CYII=';

export async function approveForm(
  request: APIRequestContext,
  token: string,
  orgId: string,
  formID: string,
  userId: string
): Promise<void> {
  const response = await request.post(orgUrl(orgId, 'forms/approve'), {
    headers: authHeaders(token),
    data: { formID, userId, signature: STUB_SIGNATURE },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { status: boolean };
  expect(payload.status).toBeTruthy();
}

export async function rejectForm(
  request: APIRequestContext,
  token: string,
  orgId: string,
  formID: string,
  userId: string,
  reason: string
): Promise<void> {
  const response = await request.post(orgUrl(orgId, 'forms/reject'), {
    headers: authHeaders(token),
    data: { formID, userId, reason },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { status: boolean };
  expect(payload.status).toBeTruthy();
}

// ─── Products ────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  hasUpi: boolean;
}

export async function getProducts(
  request: APIRequestContext,
  token: string,
  orgId: string
): Promise<Product[]> {
  const response = await request.get(orgUrl(orgId, 'products'), {
    headers: authHeaders(token),
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    status: boolean;
    products: Product[];
  };
  expect(payload.status).toBeTruthy();
  return payload.products;
}

// ─── Users ───────────────────────────────────────────────

interface OrgUser {
  user: { id: string; name: string; email: string; state: string };
  userInOrganization: { role: string };
}

export async function getUsers(
  request: APIRequestContext,
  token: string,
  orgId: string
): Promise<OrgUser[]> {
  const response = await request.get(orgUrl(orgId, 'users'), {
    headers: authHeaders(token),
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    status: boolean;
    users: OrgUser[];
  };
  expect(payload.status).toBeTruthy();
  return payload.users;
}

// ─── Utility ─────────────────────────────────────────────

export function itemByProductId(
  items: InventoryItem[],
  productId: string
): InventoryItem {
  const item = items.find((i) => i.productId === productId);
  if (!item) {
    throw new Error(`Missing inventory item for product ${productId}`);
  }
  return item;
}
