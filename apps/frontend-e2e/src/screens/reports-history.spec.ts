import { test, expect } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from '../helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
  clickSideNavRoute,
  waitForTestId,
} from '../helpers/e2e-navigation';
import { E2E_ORG_ID, E2E_ADMIN_USER_ID } from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test.describe('reports-history screen', () => {
  test('loads report for today with seeded data', async ({
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
    await clickSideNavRoute(page, 'reports-history');

    await waitForTestId(page, 'reports-history-page');
    await expect(
      page.locator('[data-testid^="reports-history-item-card-"]').first()
    ).toBeVisible({ timeout: 20000 });
  });

  test('prev/next day navigation changes date', async ({
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
    await clickSideNavRoute(page, 'reports-history');
    await waitForTestId(page, 'reports-history-page');

    const dateInput = page
      .getByTestId('reports-history-date-picker')
      .locator('input');
    const initialDate = await dateInput.inputValue();

    const prevBtn = page.getByTestId('reports-history-prev-day');
    await prevBtn.click();
    await page.waitForTimeout(1000);

    await expect(dateInput).not.toHaveValue(initialDate);

    const nextBtn = page.getByTestId('reports-history-next-day');
    await nextBtn.click();
    await page.waitForTimeout(1000);

    await expect(dateInput).toHaveValue(initialDate);
  });

  test('empty state for date with no report', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'reports-history');
    await waitForTestId(page, 'reports-history-page');

    // Go back several days to find a date without a report
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('reports-history-prev-day').click();
    }

    await expect(
      page.getByTestId('reports-history-empty-state')
    ).toBeVisible({ timeout: 15000 });
  });

  test('sort toggle reorders items', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'reports-history');
    await waitForTestId(page, 'reports-history-page');

    await expect(
      page.locator('[data-testid^="reports-history-item-card-"]').first()
    ).toBeVisible({ timeout: 20000 });

    const sortGroup = page.getByTestId('reports-history-sort-group');
    await expect(sortGroup).toBeVisible();

    await sortGroup.locator('mat-radio-button[value="product"]').click();
    await expect(page.getByTestId('reports-history-page')).toBeVisible();

    await sortGroup.locator('mat-radio-button[value="location"]').click();
    await expect(page.getByTestId('reports-history-page')).toBeVisible();
  });

  test('inspector sees reporter display name instead of reporter user id', async ({
    page,
    request,
  }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-inspector',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Inspector },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'reports-history');

    await waitForTestId(page, 'reports-history-page');

    const firstCard = page
      .locator('[data-testid^="reports-history-item-card-"]')
      .first();
    await expect(firstCard).toBeVisible({ timeout: 20000 });

    const reporterName = firstCard.locator('.reporter-name');
    await expect(reporterName).toContainText('E2E Admin');
    await expect(reporterName).not.toContainText(E2E_ADMIN_USER_ID);
  });
});
