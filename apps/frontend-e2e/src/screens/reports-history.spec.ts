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

  test('multi-sort: UPI column reorders rows; second sort column shows priority 2', async ({
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

    const rowLocator = page.locator('[data-testid^="reports-history-item-row-"]');
    await expect(rowLocator.first()).toBeVisible({ timeout: 20000 });

    const readUpiOrder = () =>
      rowLocator.evaluateAll((els) =>
        els.map((el) => {
          const id = el.getAttribute('data-testid') ?? '';
          return id.replace(/^reports-history-item-row-/, '');
        })
      );

    const initial = await readUpiOrder();
    if (initial.length < 2) {
      test.skip();
      return;
    }

    const productHeader = page.locator('th[mat-multi-sort-header="product"]');
    const upiHeader = page.locator('th[mat-multi-sort-header="upi"]');

    await productHeader.click();
    await expect(productHeader.getByText(/^1$/, { exact: true })).toBeVisible();

    await upiHeader.click();
    await expect(upiHeader.getByText(/^2$/, { exact: true })).toBeVisible();

    await upiHeader.click();
    await expect
      .poll(async () => await readUpiOrder())
      .toEqual([...initial].sort((a, b) => a.localeCompare(b)));

    await upiHeader.click();
    await expect
      .poll(async () => await readUpiOrder())
      .toEqual([...initial].sort((a, b) => b.localeCompare(a)));
  });
});
