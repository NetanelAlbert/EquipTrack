import { Page, expect } from '@playwright/test';
import {
  E2E_LANGUAGE_STORAGE_KEY,
  E2E_TEST_APP_LANGUAGE,
} from './e2e-locale';

/**
 * Inject JWT, selected organization, and language into localStorage before the
 * page loads so the Angular app boots into an authenticated session.
 */
export async function bootstrapAuthenticatedSession(
  page: Page,
  token: string,
  orgId: string
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
      (window as Window & { __EQUIP_TRACK_E2E__?: boolean }).__EQUIP_TRACK_E2E__ =
        true;
    },
    {
      jwt: token,
      selectedOrganizationId: orgId,
      languageKey: E2E_LANGUAGE_STORAGE_KEY,
      languageValue: E2E_TEST_APP_LANGUAGE,
    }
  );
}

/** URL patterns that mean auth + org are ready (role-specific default after `/`). */
const ORG_SELECTED_APP_URL = /\/(my-items|reports-history)/;

/**
 * Navigate to `/` and wait until the app either auto-redirects into the main app
 * (persisted org: `/my-items` for most roles, `/reports-history` for inspectors)
 * or shows the org picker — in which case click the org button.
 */
export async function ensureOrganizationIsSelected(
  page: Page,
  orgId: string
): Promise<void> {
  await page.goto('/');

  try {
    await expect(page).toHaveURL(ORG_SELECTED_APP_URL, { timeout: 20000 });
    return;
  } catch {
    // Staying on / — org picker is visible, click the org button.
  }

  const orgSelect = page.getByTestId(`select-organization-${orgId}`);
  await expect(orgSelect).toBeVisible({ timeout: 15000 });
  await orgSelect.click({ timeout: 30000 });
  await expect(page).toHaveURL(ORG_SELECTED_APP_URL, { timeout: 20000 });
}

/**
 * Client-side navigation via the side-nav routerLink.
 * Avoids `page.goto` full reload which can trigger APP_INITIALIZER race conditions.
 * Automatically dismisses unsaved-changes dialogs if they appear.
 */
export async function clickSideNavRoute(
  page: Page,
  route: string
): Promise<void> {
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
}

/** Wait for a `data-testid` element to become visible. */
export async function waitForTestId(
  page: Page,
  testId: string,
  timeout = 15000
): Promise<void> {
  await expect(page.getByTestId(testId)).toBeVisible({ timeout });
}

/**
 * Navigate to `/` as an inspector and wait until the app redirects to `/reports-history`
 * (the inspector's default landing route). Falls back to clicking the org picker button
 * if the org has not been selected yet.
 */
export async function ensureInspectorLandsOnReportsHistory(
  page: Page,
  orgId: string
): Promise<void> {
  await page.goto('/');

  try {
    await expect(page).toHaveURL(/\/reports-history/, { timeout: 20000 });
    return;
  } catch {
    // Still on org picker — click the org button.
  }

  const orgSelect = page.getByTestId(`select-organization-${orgId}`);
  await expect(orgSelect).toBeVisible({ timeout: 15000 });
  await orgSelect.click({ timeout: 30000 });
  await expect(page).toHaveURL(/\/reports-history/, { timeout: 20000 });
}

/**
 * Navigate to the create-form page via the side-nav link.
 * Retries up to 3 times to handle cold-start APP_INITIALIZER race conditions.
 */
export async function openCreateFormPage(
  page: Page,
  orgId: string
): Promise<void> {
  const createFormPage = page.getByTestId('create-form-page');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const orgPicker = page.getByTestId('organization-selection-page');
    const onOrgPicker =
      (await orgPicker.count()) > 0 &&
      (await orgPicker.first().isVisible().catch(() => false));

    if (onOrgPicker) {
      const selectBtn = page.getByTestId(`select-organization-${orgId}`);
      await expect(selectBtn).toBeEnabled({ timeout: 20000 });
      await selectBtn.click();
      await expect(page).toHaveURL(/\/my-items/, { timeout: 20000 });
    }

    await clickSideNavRoute(page, 'create-form');

    try {
      await createFormPage.waitFor({ state: 'visible', timeout: 10000 });
      return;
    } catch {
      // Retry after recovery paths below
    }

    if (await page.getByTestId('login-page').isVisible().catch(() => false)) {
      throw new Error(
        'Unexpected redirect to login while opening create-form page'
      );
    }
  }

  await expect(createFormPage).toBeVisible({ timeout: 15000 });
}

/**
 * Fill one row in the editable-inventory component.
 * Selects a product from the autocomplete and sets the quantity.
 */
export async function fillInventoryRow(
  page: Page,
  rowIndex: number,
  productId: string,
  quantity: number
): Promise<void> {
  const createFormOverlay = page.getByTestId('create-form-loading-overlay');
  if ((await createFormOverlay.count()) > 0) {
    await expect(createFormOverlay).toBeHidden({ timeout: 120_000 });
  }

  const row = page.getByTestId('editable-item-row').nth(rowIndex);
  await row.getByTestId('editable-item-product-input').click();
  await row.getByTestId('editable-item-product-input').fill(productId);
  await page
    .locator(`[data-testid="editable-item-product-option-${productId}"]`)
    .first()
    .click();

  await row.getByTestId('editable-item-quantity-input').fill(String(quantity));
}

/**
 * Click the "Check in items" button on an approved check-out form card and complete
 * the check-in dialog by drawing a signature and submitting.
 * Waits for the POST /check-in request to succeed.
 */
export async function recordCheckInViaDialog(
  page: Page,
  description: string
): Promise<void> {
  const formCard = page
    .locator('[data-testid^="form-card-"]')
    .filter({ hasText: description })
    .first();
  await expect(formCard).toBeVisible({ timeout: 20000 });

  await formCard.locator('[data-testid^="form-checkin-"]').click();

  // Dialog should open
  await expect(page.getByTestId('check-in-dialog-content')).toBeVisible({ timeout: 10000 });

  // Add inventory row defaults are pre-filled with outstanding items.
  // If not, add one row with the first available item.
  const addItemBtn = page.getByTestId('editable-inventory-add-item');
  if ((await addItemBtn.count()) > 0 && (await page.getByTestId('editable-item-row').count()) === 0) {
    await addItemBtn.click();
  }

  // Draw signature
  const signatureCanvas = page.getByTestId('check-in-signature-pad').locator('canvas').first();
  await expect(signatureCanvas).toBeVisible({ timeout: 10000 });
  const box = await signatureCanvas.boundingBox();
  if (!box) throw new Error('Cannot draw check-in signature: no bounding box');
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 80);
  await page.mouse.up();

  const checkInRequest = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/check-in') && r.ok(),
    { timeout: 30000 }
  );
  const submitBtn = page.getByTestId('editable-inventory-submit');
  await expect(submitBtn).toBeEnabled({ timeout: 10000 });
  await submitBtn.click();
  await checkInRequest;
}

/**
 * Approve the latest pending form matching the given description.
 * Draws a mouse signature and clicks the approve button inside the signature dialog.
 */
export async function approveLatestPendingForm(
  page: Page,
  description: string
): Promise<void> {
  const formCard = page
    .locator('[data-testid^="form-card-"]')
    .filter({ hasText: description })
    .first();
  await expect(formCard).toBeVisible({ timeout: 20000 });

  await formCard.locator('[data-testid^="form-approve-"]').click();

  const signatureCanvas = page.getByTestId('signature-pad-canvas');
  await expect(signatureCanvas).toBeVisible();

  const box = await signatureCanvas.boundingBox();
  if (!box) {
    throw new Error('Unable to draw signature: canvas has no bounding box');
  }

  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 100);
  await page.mouse.up();

  const signatureOk = page.getByTestId('signature-dialog-approve');
  await expect(signatureOk).toBeEnabled({ timeout: 10000 });

  const approveRequest = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.url().includes('/forms/approve') &&
      r.ok(),
    { timeout: 30000 }
  );
  await signatureOk.click();
  await approveRequest;

  await page.getByTestId('forms-status-filter').click();
  await page.locator('mat-option[value="all"]').click();

  const cardAfterApprove = page
    .locator('[data-testid^="form-card-"]')
    .filter({ hasText: description })
    .first();
  await expect(
    cardAfterApprove.locator('[data-testid^="form-status-"]')
  ).toHaveClass('approved', { timeout: 30000 });
}
