import { Page, expect, test } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from './helpers/e2e-auth';
import {
  E2E_LANGUAGE_STORAGE_KEY,
  E2E_TEST_APP_LANGUAGE,
} from './helpers/e2e-locale';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';
const organizationId = 'org-e2e-main';

async function bootstrapAuthenticatedSession(
  page: Page,
  token: string
): Promise<void> {
  await page.addInitScript(
    ({
      jwt,
      selectedOrganizationId,
      languageKey,
      languageValue,
    }: {
      jwt: string;
      selectedOrganizationId: string;
      languageKey: string;
      languageValue: string;
    }) => {
      window.localStorage.setItem('equip-track-token', jwt);
      window.localStorage.setItem(
        'equip-track-selected-org',
        selectedOrganizationId
      );
      window.localStorage.setItem(languageKey, languageValue);
    },
    {
      jwt: token,
      selectedOrganizationId: organizationId,
      languageKey: E2E_LANGUAGE_STORAGE_KEY,
      languageValue: E2E_TEST_APP_LANGUAGE,
    }
  );
}

async function ensureOrganizationIsSelected(page: Page): Promise<void> {
  await page.goto('/');

  try {
    await expect(page).toHaveURL(/\/my-items/, { timeout: 20000 });
    return;
  } catch {
    // Staying on / — show org grid and require a click.
  }

  const orgSelect = page.getByTestId(
    `select-organization-${organizationId}`
  );
  // On cold starts the app may still be loading (no org buttons yet).
  // Wait longer and retry goto once.
  try {
    await expect(orgSelect).toBeVisible({ timeout: 20000 });
  } catch {
    await page.goto('/');
    try {
      await expect(page).toHaveURL(/\/my-items/, { timeout: 20000 });
      return;
    } catch {
      // Retry org select
    }
    await expect(orgSelect).toBeVisible({ timeout: 20000 });
  }
  await orgSelect.click({ timeout: 30000 });
  await expect(page).toHaveURL(/\/my-items/, { timeout: 20000 });
}

function clickSideNavRoute(page: Page, route: string): Promise<void> {
  return (async () => {
    const link = page.getByTestId(`nav-link-${route}`);
    await link.waitFor({ state: 'attached', timeout: 20000 });
    await link.evaluate((el: HTMLElement) => el.click());

    const leaveUnsaved = page.getByRole('button', { name: /^Leave$/i });
    try {
      await leaveUnsaved.waitFor({ state: 'visible', timeout: 4000 });
      await leaveUnsaved.click();
    } catch {
      // No unsaved-changes dialog
    }
  })();
}

async function openCreateFormPage(page: Page): Promise<void> {
  const createFormPage = page.getByTestId('create-form-page');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const orgPicker = page.getByTestId('organization-selection-page');
    const onOrgPicker =
      (await orgPicker.count()) > 0 &&
      (await orgPicker.first().isVisible().catch(() => false));

    if (onOrgPicker) {
      const selectBtn = page.getByTestId(
        `select-organization-${organizationId}`
      );
      await expect(selectBtn).toBeEnabled({ timeout: 20000 });
      await selectBtn.click();
      await expect(page).toHaveURL(/\/my-items/, { timeout: 20000 });
    }

    await clickSideNavRoute(page, 'create-form');

    try {
      await createFormPage.waitFor({ state: 'visible', timeout: 10000 });
      return;
    } catch {
      // Retry
    }

    if (
      await page
        .getByTestId('login-page')
        .isVisible()
        .catch(() => false)
    ) {
      throw new Error(
        'Unexpected redirect to login while opening create-form page'
      );
    }
  }

  await expect(createFormPage).toBeVisible({ timeout: 15000 });
}

async function navigateToCreateForm(
  page: Page,
  token: string
): Promise<void> {
  await bootstrapAuthenticatedSession(page, token);
  await ensureOrganizationIsSelected(page);
  await openCreateFormPage(page);
}

test.describe('create-form page', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: {
        [organizationId]: UserRole.Admin,
      },
    });
  });

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

  test('form type radio buttons switch between check-out and check-in', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await navigateToCreateForm(page, adminToken);

    const checkoutRadio = page.getByTestId('form-type-checkout');
    const checkinRadio = page.getByTestId('form-type-checkin');

    await expect(checkoutRadio).toBeVisible();
    await expect(checkinRadio).toBeVisible();

    const explanation = page.locator('.explanation p');
    await expect(explanation).toContainText('Check out');

    await checkinRadio.click();
    await expect(explanation).toContainText('Check in');

    await checkoutRadio.click();
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
});
