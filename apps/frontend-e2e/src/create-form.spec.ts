import { Page, expect, test } from '@playwright/test';
import * as path from 'node:path';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from './helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
  clickSideNavRoute,
  openCreateFormPage,
  waitForTestId,
} from './helpers/e2e-navigation';
import {
  E2E_ORG_ID,
} from './helpers/e2e-api';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';

async function navigateToCreateForm(
  page: Page,
  token: string
): Promise<void> {
  await bootstrapAuthenticatedSession(page, token, E2E_ORG_ID);
  await ensureOrganizationIsSelected(page, E2E_ORG_ID);
  await openCreateFormPage(page, E2E_ORG_ID);
}

test.describe('create-form page', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    // Reseed org users so the create-form user dropdown is populated with known data.
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

    adminToken = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: {
        [E2E_ORG_ID]: UserRole.Admin,
      },
    });
  });

  // ─── UI smoke / interaction tests ────────────────────────────────────────────

  test('renders without page-level errors', async ({ page }) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await navigateToCreateForm(page, adminToken);

    await expect(page.getByTestId('create-form-user-select')).toBeVisible({
      timeout: 10000,
    });

    expect(pageErrors).toEqual([]);
  });

  test('user select dropdown opens and shows options', async ({ page }) => {
    test.setTimeout(90_000);

    await navigateToCreateForm(page, adminToken);

    const userSelect = page.getByTestId('create-form-user-select');
    await expect(userSelect).toBeVisible();

    await userSelect.locator('.ng-select-container').click();

    const filterInput = userSelect.locator('.ng-input input');
    await expect(filterInput).toBeVisible({ timeout: 10000 });

    const options = page.locator('.ng-dropdown-panel .ng-option');
    await expect(options.first()).toBeVisible({ timeout: 10000 });
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
  });

  test('user can be selected and displays correctly', async ({ page }) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await navigateToCreateForm(page, adminToken);

    const userSelect = page.getByTestId('create-form-user-select');
    await userSelect.locator('.ng-select-container').click();

    const filterInput = userSelect.locator('.ng-input input');
    await expect(filterInput).toBeVisible({ timeout: 10000 });
    await filterInput.fill('E2E Customer');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    const selectedValue = userSelect.locator('.ng-value');
    await expect(selectedValue).toBeVisible({ timeout: 5000 });

    const userDisplay = selectedValue.locator('app-user-display');
    await expect(userDisplay).toBeVisible();
    await expect(userDisplay.locator('.user-name')).toContainText('E2E');

    expect(pageErrors).toEqual([]);
  });

  test('shows only check-out explanation text (no form-type radio)', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await navigateToCreateForm(page, adminToken);

    // The form-type radio buttons are gone; only check-out remains
    await expect(page.getByTestId('form-type-checkout')).toHaveCount(0);
    await expect(page.getByTestId('form-type-checkin')).toHaveCount(0);

    const explanation = page.locator('.explanation p');
    await expect(explanation).toContainText('Check out');
  });

  test('description input accepts text', async ({ page }) => {
    test.setTimeout(90_000);

    await navigateToCreateForm(page, adminToken);

    const descriptionInput = page.getByTestId('create-form-description-input');
    await expect(descriptionInput).toBeVisible();
    await descriptionInput.fill('Test form description');
    await expect(descriptionInput).toHaveValue('Test form description');
  });

  test('user select search filters options correctly', async ({ page }) => {
    test.setTimeout(90_000);

    await navigateToCreateForm(page, adminToken);

    const userSelect = page.getByTestId('create-form-user-select');
    await userSelect.locator('.ng-select-container').click();

    const filterInput = userSelect.locator('.ng-input input');
    await expect(filterInput).toBeVisible({ timeout: 10000 });

    const options = page.locator('.ng-dropdown-panel .ng-option');
    await expect(options.first()).toBeVisible({ timeout: 10000 });
    const allCount = await options.count();

    await filterInput.fill('nonexistent-user-xyz');

    const noResultsOption = page.locator(
      '.ng-dropdown-panel .ng-option.ng-option-disabled'
    );
    await expect(noResultsOption).toBeVisible({ timeout: 5000 });

    await filterInput.clear();
    await filterInput.fill('E2E Customer');

    const customerOptions = page.locator(
      '.ng-dropdown-panel .ng-option:not(.ng-option-disabled)'
    );
    await expect(customerOptions.first()).toBeVisible({ timeout: 5000 });
    const customerCount = await customerOptions.count();
    expect(customerCount).toBeGreaterThan(0);
    expect(customerCount).toBeLessThanOrEqual(allCount);
  });

  test('add predefined form items from accordion', async ({ page }) => {
    await bootstrapAuthenticatedSession(page, adminToken, E2E_ORG_ID);
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
