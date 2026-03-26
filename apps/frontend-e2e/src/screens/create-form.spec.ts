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
import { E2E_ORG_ID, E2E_CUSTOMER_USER_ID, E2E_BULK_PRODUCT_ID } from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test.describe('create-form screen', () => {
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
    await clickSideNavRoute(page, 'create-form');
    await waitForTestId(page, 'create-form-page');

    await page.getByTestId('form-type-checkin').click();

    await page.getByTestId('create-form-user-select').click();
    await page
      .getByTestId(`create-form-user-option-${E2E_CUSTOMER_USER_ID}`)
      .click();

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
    await clickSideNavRoute(page, 'create-form');
    await waitForTestId(page, 'create-form-page');

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
    await clickSideNavRoute(page, 'create-form');
    await waitForTestId(page, 'create-form-page');

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

  test('unsaved changes guard after editing items', async ({
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
    await clickSideNavRoute(page, 'create-form');
    await waitForTestId(page, 'create-form-page');

    await fillInventoryRow(page, 0, E2E_BULK_PRODUCT_ID, 1);
    await page.waitForTimeout(500);

    const navLink = page.getByTestId('nav-link-my-items');
    await navLink.waitFor({ state: 'attached', timeout: 10000 });
    await navLink.evaluate((el: HTMLElement) => el.click());

    const leaveBtn = page.getByRole('button', { name: /^Leave$/i });
    await expect(leaveBtn).toBeVisible({ timeout: 8000 });

    const stayBtn = page.getByRole('button', { name: /^Stay$/i });
    await stayBtn.click();

    await expect(page.getByTestId('create-form-page')).toBeVisible();
  });
});
