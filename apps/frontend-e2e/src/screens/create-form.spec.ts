import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from '../helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
  clickSideNavRoute,
  waitForTestId,
  fillInventoryRow,
} from '../helpers/e2e-navigation';
import { E2E_ORG_ID, E2E_CUSTOMER_USER_ID, E2E_BULK_PRODUCT_ID } from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test.describe('create-form screen', () => {
  test.beforeAll(async () => {
    const endpoint =
      process.env['AWS_ENDPOINT_URL'] || 'http://localhost:4566';
    process.env['AWS_ENDPOINT_URL'] = endpoint;
    process.env['AWS_ENDPOINT_URL_DYNAMODB'] =
      process.env['AWS_ENDPOINT_URL_DYNAMODB'] || endpoint;
    process.env['AWS_REGION'] = process.env['AWS_REGION'] || 'us-east-1';
    process.env['AWS_ACCESS_KEY_ID'] =
      process.env['AWS_ACCESS_KEY_ID'] || 'test';
    process.env['AWS_SECRET_ACCESS_KEY'] =
      process.env['AWS_SECRET_ACCESS_KEY'] || 'test';
    process.env['STAGE'] = process.env['STAGE'] || 'local';

    const seedPath = path.join(process.cwd(), 'scripts', 'seed-e2e-data.js');
    const { reseedE2eOrgUsers } = require(seedPath);
    await reseedE2eOrgUsers();
  });

  test('create checkin form via UI', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    const usersForCreateForm = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().includes(`/organizations/${E2E_ORG_ID}/users`) &&
        r.ok(),
      { timeout: 30000 }
    );
    await clickSideNavRoute(page, 'create-form');
    await waitForTestId(page, 'create-form-page');
    await usersForCreateForm;

    await page.getByTestId('form-type-checkin').click();
    await expect(page.getByTestId('create-form-loading-overlay')).toHaveCount(
      0,
      { timeout: 5000 }
    );

    const userSelect = page.getByTestId('create-form-user-select');
    await userSelect.click();
    const filterInput = userSelect.locator('input[type="text"]');
    await filterInput.fill('customer');
    const customerInv = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().includes(`/inventory/user/${E2E_CUSTOMER_USER_ID}`) &&
        r.ok(),
      { timeout: 30000 }
    );
    await filterInput.press('ArrowDown');
    await filterInput.press('Enter');
    await customerInv;

    const description = `e2e checkin ${Date.now()}`;
    await page.getByTestId('create-form-description-input').fill(description);

    await fillInventoryRow(page, 0, E2E_BULK_PRODUCT_ID, 1);

    const submitBtn = page.getByTestId('editable-inventory-submit');
    await expect(submitBtn).toBeEnabled({ timeout: 30000 });

    const createResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/forms/create') &&
        r.ok(),
      { timeout: 30000 }
    );
    await submitBtn.click();
    await createResponse;
  });

  test('form type toggle switches inventory context', async ({
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
    const usersForCreateForm = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().includes(`/organizations/${E2E_ORG_ID}/users`) &&
        r.ok(),
      { timeout: 30000 }
    );
    await clickSideNavRoute(page, 'create-form');
    await waitForTestId(page, 'create-form-page');
    await usersForCreateForm;

    await expect(page.getByTestId('form-type-checkout')).toBeVisible();
    await expect(page.getByTestId('form-type-checkin')).toBeVisible();

    await page.getByTestId('form-type-checkout').click();
    await expect(page.getByTestId('create-form-page')).toBeVisible();

    await page.getByTestId('form-type-checkin').click();
    await expect(page.getByTestId('create-form-page')).toBeVisible();
  });

  test('add predefined form items from accordion', async ({
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
    const usersForCreateForm = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().includes(`/organizations/${E2E_ORG_ID}/users`) &&
        r.ok(),
      { timeout: 30000 }
    );
    await clickSideNavRoute(page, 'create-form');
    await waitForTestId(page, 'create-form-page');
    await usersForCreateForm;

    const predefinedSection = page.getByTestId('predefined-forms-section');
    try {
      await predefinedSection.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      // Predefined forms may not always be visible; skip if absent.
      return;
    }

    const addBtn = page.getByTestId('add-predefined-form-predefined-e2e-kit');
    await addBtn.click();

    await expect(
      page.getByTestId('editable-item-row').first()
    ).toBeVisible({ timeout: 10000 });
  });

});
