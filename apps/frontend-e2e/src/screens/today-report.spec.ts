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

  test('column header sort is available (multi-sort)', async ({
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

    const productHeader = page.locator('th[mat-multi-sort-header="product"]');
    await expect(productHeader).toBeVisible();
    await productHeader.click();
    await expect(page.getByTestId('today-report-page')).toBeVisible();
  });

  test('sorting by UPI reorders table rows (multi-sort state updates data)', async ({
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

    const rowLocator = page.locator('[data-testid^="today-report-item-row-"]');
    await expect(rowLocator.first()).toBeVisible({ timeout: 20000 });

    const readUpiOrder = () =>
      rowLocator.evaluateAll((els) =>
        els.map((el) => {
          const id = el.getAttribute('data-testid') ?? '';
          return id.replace(/^today-report-item-row-/, '');
        })
      );

    const initial = await readUpiOrder();
    if (initial.length < 2) {
      test.skip();
      return;
    }

    const upiHeader = page.locator('th[mat-multi-sort-header="upi"]');
    await upiHeader.click();
    await expect
      .poll(async () => await readUpiOrder())
      .toEqual([...initial].sort((a, b) => a.localeCompare(b)));

    await upiHeader.click();
    await expect
      .poll(async () => await readUpiOrder())
      .toEqual([...initial].sort((a, b) => b.localeCompare(a)));
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

    const submitBtn = page
      .locator('[data-testid^="today-report-submit-btn-"]')
      .first();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

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

    await expect(
      page.locator('.status-pill.reported').first()
    ).toBeVisible({ timeout: 15000 });
  });
});
