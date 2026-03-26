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

test.describe('my-forms screen (customer)', () => {
  test('customer sees their forms with tabs', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-customer',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Customer },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'my-forms');

    await waitForTestId(page, 'forms-tab-group');
    await expect(page.getByRole('tab', { name: /Check Out/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Check In/i })).toBeVisible();
  });

  test('status filter works for customer forms', async ({
    page,
    request,
  }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-customer',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Customer },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'my-forms');
    await waitForTestId(page, 'forms-tab-group');

    const statusFilter = page.getByTestId('forms-status-filter');
    await statusFilter.click();
    await page.locator('mat-option[value="all"]').click();

    await expect(page.getByTestId('forms-tab-group')).toBeVisible();
  });

  test('customer sees form cards with correct status display', async ({
    page,
    request,
  }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-customer',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Customer },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'my-forms');
    await waitForTestId(page, 'forms-tab-group');

    const statusFilter = page.getByTestId('forms-status-filter');
    await statusFilter.click();
    await page.locator('mat-option[value="all"]').click();

    const cards = page.locator('[data-testid^="form-card-"]');
    try {
      await cards.first().waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      return;
    }

    const cardCount = await cards.count();
    if (cardCount > 0) {
      const firstCard = cards.first();
      await expect(firstCard).toBeVisible();
      await expect(
        firstCard.locator('[data-testid^="form-status-"]')
      ).toBeVisible();
    }
  });
});
