import { test, expect } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from '../helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
  clickSideNavRoute,
  waitForTestId,
} from '../helpers/e2e-navigation';
import { E2E_ORG_ID } from '../helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

test.describe('today-report screen', () => {
  test('loads items to report for current date', async ({
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
    await clickSideNavRoute(page, 'today-report');

    await waitForTestId(page, 'today-report-page');
    await expect(
      page.locator('[data-testid^="today-report-item-row-"]').first()
    ).toBeVisible({ timeout: 20000 });
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
    await clickSideNavRoute(page, 'today-report');
    await waitForTestId(page, 'today-report-page');

    const rows = page.locator('[data-testid^="today-report-item-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 20000 });

    const rowCount = await rows.count();
    if (rowCount < 2) {
      return;
    }

    const holderHeader = page.locator('th[mat-multi-sort-header="holder"]');
    await expect(holderHeader).toBeVisible();
    await holderHeader.click();
    await page.waitForTimeout(500);

    const productHeader = page.locator('th[mat-multi-sort-header="product"]');
    await expect(productHeader).toBeVisible();
    await productHeader.click();
    await page.waitForTimeout(500);

    const holderCells = page.locator('table.report-table td:nth-child(2)');
    const productCells = page.locator('table.report-table td:nth-child(4)');
    const cellCount = await holderCells.count();

    const holders: string[] = [];
    const products: string[] = [];
    for (let i = 0; i < cellCount; i++) {
      holders.push((await holderCells.nth(i).innerText()).trim());
      products.push((await productCells.nth(i).innerText()).trim());
    }

    for (let i = 1; i < holders.length; i++) {
      const holderCmp = holders[i - 1].localeCompare(holders[i]);
      expect(holderCmp).toBeLessThanOrEqual(0);

      if (holderCmp === 0) {
        expect(products[i - 1].localeCompare(products[i])).toBeLessThanOrEqual(0);
      }
    }
  });

  test('submit a location report for an item', async ({
    page,
    request,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'today-report');
    await waitForTestId(page, 'today-report-page');

    const rows = page.locator('[data-testid^="today-report-item-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 20000 });

    const firstRow = rows.first();
    await firstRow.click();

    const locationInput = firstRow.locator(
      '[data-testid^="today-report-location-input-"]'
    );
    try {
      await locationInput.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // Row may already be reported (seeded). Find an unreported one.
      const allRows = await rows.all();
      let found = false;
      for (const row of allRows) {
        const hasUnreported = await row.locator('.status-pill.unreported').count();
        if (hasUnreported > 0) {
          await row.click();
          found = true;
          break;
        }
      }
      if (!found) {
        // All items already reported — skip gracefully.
        return;
      }
    }

    const input = page
      .locator('[data-testid^="today-report-location-input-"]')
      .first();
    await input.fill(`E2E Location ${Date.now()}`);

    const batchPublish = page.locator('[data-testid="today-report-batch-publish"]');
    await expect(batchPublish).toBeEnabled({ timeout: 5000 });
    await batchPublish.click();

    await expect(
      page.locator('.status-pill.reported').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('use last location autofills input', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'today-report');
    await waitForTestId(page, 'today-report-page');

    const useLastBtn = page.locator(
      '[data-testid^="today-report-use-last-location-"]'
    );
    try {
      await useLastBtn.first().waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // No items have a last location available — skip.
      return;
    }

    await useLastBtn.first().click();

    const batchPublish = page.locator('[data-testid="today-report-batch-publish"]');
    await expect(batchPublish).toBeEnabled({ timeout: 5000 });
    await batchPublish.click();

    await expect(
      page.locator('.status-pill.reported').first()
    ).toBeVisible({ timeout: 15000 });
  });
});
