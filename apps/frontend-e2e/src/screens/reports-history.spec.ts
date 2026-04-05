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
      page.locator('[data-testid^="reports-history-item-row-"]').first()
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

  test('past date without saved report still shows expected items (not-reported rows)', async ({
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

    for (let i = 0; i < 8; i++) {
      await page.getByTestId('reports-history-prev-day').click();
    }

    await expect(page.locator('table.report-table')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId('reports-history-counts')).toBeVisible();
  });

  test('multi-sort: second column sort affects row order', async ({
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

    const rows = page.locator('[data-testid^="reports-history-item-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 20000 });

    const rowCount = await rows.count();
    if (rowCount < 2) {
      return;
    }

    const holderHeader = page.locator('th[mat-multi-sort-header="holder"]');
    await expect(holderHeader).toBeVisible();
    await holderHeader.click();
    await expect(
      holderHeader.locator('.mat-sort-header-sorted')
    ).toBeVisible({ timeout: 5000 });

    const productHeader = page.locator('th[mat-multi-sort-header="product"]');
    await expect(productHeader).toBeVisible();
    await productHeader.click();
    await expect(
      productHeader.locator('.mat-sort-header-sorted')
    ).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(500);

    const dataRows = page.locator('table.report-table tbody tr');
    const cellCount = await dataRows.count();

    const holders: string[] = [];
    const products: string[] = [];
    for (let i = 0; i < cellCount; i++) {
      const tds = dataRows.nth(i).locator('td');
      holders.push((await tds.nth(4).innerText()).trim());
      products.push((await tds.nth(0).innerText()).trim());
    }

    for (let i = 1; i < holders.length; i++) {
      const holderCmp = holders[i - 1].localeCompare(holders[i]);
      expect(
        holderCmp,
        `Holder sort broken at index ${i}: "${holders[i - 1]}" vs "${holders[i]}"`
      ).toBeLessThanOrEqual(0);

      if (holderCmp === 0) {
        expect(
          products[i - 1].localeCompare(products[i]),
          `Product sort broken at index ${i} within holder "${holders[i]}": "${products[i - 1]}" vs "${products[i]}"`
        ).toBeLessThanOrEqual(0);
      }
    }
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
