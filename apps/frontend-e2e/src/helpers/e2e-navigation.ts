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
    },
    {
      jwt: token,
      selectedOrganizationId: orgId,
      languageKey: E2E_LANGUAGE_STORAGE_KEY,
      languageValue: E2E_TEST_APP_LANGUAGE,
    }
  );
}

/**
 * Navigate to `/` and wait until the app either auto-redirects to `/my-items`
 * (persisted org) or shows the org picker — in which case click the org button.
 */
export async function ensureOrganizationIsSelected(
  page: Page,
  orgId: string
): Promise<void> {
  await page.goto('/');

  try {
    await expect(page).toHaveURL(/\/my-items/, { timeout: 20000 });
    return;
  } catch {
    // Staying on / — org picker is visible, click the org button.
  }

  const orgSelect = page.getByTestId(`select-organization-${orgId}`);
  await expect(orgSelect).toBeVisible({ timeout: 15000 });
  await orgSelect.click({ timeout: 30000 });
  await expect(page).toHaveURL(/\/my-items/, { timeout: 20000 });
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
 * Fill one row in the editable-inventory component.
 * Selects a product from the autocomplete and sets the quantity.
 */
export async function fillInventoryRow(
  page: Page,
  rowIndex: number,
  productId: string,
  quantity: number
): Promise<void> {
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
