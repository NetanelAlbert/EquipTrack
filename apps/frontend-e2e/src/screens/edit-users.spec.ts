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

test.describe('edit-users screen', () => {
  test('loads user table with seeded users', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'edit-users');
    await waitForTestId(page, 'edit-users-page');

    const table = page.getByTestId('edit-users-table');
    await expect(table).toBeVisible({ timeout: 15000 });

    const tableText = await table.textContent();
    expect(tableText).toContain('E2E Admin');
    expect(tableText).toContain('E2E Customer');
  });

  test('invite a new user', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(60_000);
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    const uniqueEmail = `e2e-invite-${Date.now()}@example.com`;

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await ensureOrganizationIsSelected(page, E2E_ORG_ID);
    await clickSideNavRoute(page, 'edit-users');
    await waitForTestId(page, 'edit-users-page');

    await page.getByTestId('edit-users-email-input').fill(uniqueEmail);
    await page.getByTestId('edit-users-name-input').fill('E2E Invited User');

    await page.getByTestId('edit-users-role-select').click();
    await page
      .locator('mat-option')
      .filter({ hasText: /customer/i })
      .first()
      .click();
    await page.waitForTimeout(500);

    await page.getByTestId('edit-users-department-select').click({ force: true });
    await page.locator('mat-option').first().click();

    await page
      .getByTestId('edit-users-role-description-input')
      .fill('E2E test role');

    const inviteBtn = page.getByTestId('edit-users-invite-btn');
    await expect(inviteBtn).toBeEnabled({ timeout: 5000 });

    const inviteResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/users/invite') &&
        r.ok(),
      { timeout: 30000 }
    );
    await inviteBtn.click();
    await inviteResponse;

    const table = page.getByTestId('edit-users-table');
    await expect(table).toContainText(uniqueEmail, { timeout: 15000 });
  });

  test('query param prefills email', async ({ page, request }) => {
    const token = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: { [E2E_ORG_ID]: UserRole.Admin },
    });

    await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
    await page.goto('/edit-users?email=prefill@example.com');

    await waitForTestId(page, 'edit-users-page');

    const emailInput = page.getByTestId('edit-users-email-input');
    await expect(emailInput).toHaveValue('prefill@example.com', {
      timeout: 15000,
    });
  });

  test('unsaved changes guard on dirty invite form', async ({
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
    await clickSideNavRoute(page, 'edit-users');
    await waitForTestId(page, 'edit-users-page');

    await page.getByTestId('edit-users-email-input').fill('dirty@example.com');

    const navLink = page.getByTestId('nav-link-my-items');
    await navLink.waitFor({ state: 'attached', timeout: 10000 });
    await navLink.evaluate((el: HTMLElement) => el.click());

    const leaveBtn = page.getByRole('button', { name: /^Leave$/i });
    await expect(leaveBtn).toBeVisible({ timeout: 8000 });

    const stayBtn = page.getByRole('button', { name: /^Stay$/i });
    await stayBtn.click();

    await expect(page.getByTestId('edit-users-page')).toBeVisible();
  });
});
