import { test, expect } from '@playwright/test';
import { FormType, UserRole } from '@equip-track/shared';
import { mintE2eJwt } from '../helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
  clickSideNavRoute,
  waitForTestId,
} from '../helpers/e2e-navigation';
import {
  E2E_ORG_ID,
  E2E_CUSTOMER_USER_ID,
  E2E_BULK_PRODUCT_ID,
  createForm,
} from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test.describe('forms screen', () => {
  test('displays checkout and checkin tabs with forms', async ({
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
    await clickSideNavRoute(page, 'forms');

    await waitForTestId(page, 'forms-tab-group');
    await expect(page.getByRole('tab', { name: /Check Out/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Check In/i })).toBeVisible();

    await expect(page.getByTestId('forms-tab-content').first()).toBeVisible();
  });

  test('status filter shows forms by status', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'forms');
    await waitForTestId(page, 'forms-tab-group');

    const statusFilter = page.getByTestId('forms-status-filter');
    await statusFilter.click();
    await page.locator('mat-option[value="all"]').click();

    await expect(
      page.locator('[data-testid^="forms-card-"]').first()
    ).toBeVisible({ timeout: 15000 });

    await statusFilter.click();
    await page.locator('mat-option[value="approved"]').click();

    const content = page.getByTestId('forms-tab-content').first();
    const cards = content.locator('[data-testid^="forms-card-"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const checkCount = Math.min(cardCount, 5);
    for (let i = 0; i < checkCount; i++) {
      const statusEl = cards.nth(i).locator('[data-testid^="form-status-"]');
      await expect(statusEl).toHaveClass(/approved/);
    }
  });

  test('search filters forms by description', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'forms');
    await waitForTestId(page, 'forms-tab-group');

    const statusFilter = page.getByTestId('forms-status-filter');
    await statusFilter.click();
    await page.locator('mat-option[value="all"]').click();

    const searchInput = page.getByTestId('forms-search-input');
    await searchInput.fill('e2e-seed-approved-checkout');

    await expect(
      page
        .locator('[data-testid^="form-card-"]')
        .filter({ hasText: 'e2e-seed-approved-checkout' })
        .first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('reject a pending form with reason', async ({
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

    const description = `e2e reject test ${Date.now()}`;
    await createForm(request, token, E2E_ORG_ID, {
      formType: FormType.CheckOut,
      userId: E2E_CUSTOMER_USER_ID,
      items: [{ productId: E2E_BULK_PRODUCT_ID, quantity: 1 }],
      description,
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'forms');
    await waitForTestId(page, 'forms-tab-group');

    const formCard = page
      .locator('[data-testid^="form-card-"]')
      .filter({ hasText: description })
      .first();
    await expect(formCard).toBeVisible({ timeout: 20000 });

    await formCard.locator('[data-testid^="form-reject-"]').click();

    const reasonInput = page.locator('mat-dialog-container textarea');
    await expect(reasonInput).toBeVisible({ timeout: 10000 });
    await reasonInput.fill('e2e automated rejection');

    const confirmReject = page.locator(
      'mat-dialog-container button:has-text("Confirm")'
    );
    await confirmReject.click();

    await page.waitForTimeout(2000);

    await page.getByTestId('forms-status-filter').click();
    await page.locator('mat-option[value="all"]').click();

    const rejectedCard = page
      .locator('[data-testid^="form-card-"]')
      .filter({ hasText: description })
      .first();
    await expect(
      rejectedCard.locator('[data-testid^="form-status-"]')
    ).toHaveClass(/rejected/, { timeout: 30000 });
  });

  test('clone form navigates to create-form', async ({
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
    await clickSideNavRoute(page, 'forms');
    await waitForTestId(page, 'forms-tab-group');

    const statusFilter = page.getByTestId('forms-status-filter');
    await statusFilter.click();
    await page.locator('mat-option[value="all"]').click();

    const firstCard = page.locator('[data-testid^="form-card-"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    await firstCard.locator('[data-testid^="form-clone-"]').click();
    await expect(page).toHaveURL(/\/create-form/, { timeout: 20000 });
    await waitForTestId(page, 'create-form-page');
  });
});
