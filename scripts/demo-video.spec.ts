/**
 * Demo script: full check-out → partial check-in → full check-in flow.
 */
import { test, expect, Page } from '@playwright/test';

const JWT = process.env['DEMO_JWT'] || '';
const BASE_URL = 'http://localhost:4200';
const DESCRIPTION = `Demo checkout ${Date.now()}`;

async function pause(ms = 1200) {
  await new Promise((r) => setTimeout(r, ms));
}

async function drawSignature(page: Page) {
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 10000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('No canvas bounding box');
  await page.mouse.move(box.x + 40, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 90, { steps: 25 });
  await page.mouse.move(box.x + 200, box.y + 50, { steps: 25 });
  await page.mouse.up();
}

async function clickNavLink(page: Page, route: string) {
  const link = page.getByTestId(`nav-link-${route}`);
  await link.waitFor({ state: 'attached', timeout: 20000 });
  await link.evaluate((el: HTMLElement) => el.click());
  await pause(500);
}

test('full flow demo: check-out → partial check-in → full check-in', async ({ page }) => {
  test.setTimeout(300_000);

  // ── Step 1: Bootstrap authenticated session ───────────────────────────────
  await page.addInitScript(({ jwt, org }: { jwt: string; org: string }) => {
    localStorage.setItem('equip-track-token', jwt);
    localStorage.setItem('equip-track-selected-org', org);
    localStorage.setItem('equip-track-language', 'en');
    (window as never as Record<string, boolean>)['__EQUIP_TRACK_E2E__'] = true;
  }, { jwt: JWT, org: 'org-e2e-main' });

  await page.goto('/');
  // Wait for app to boot into main app or org-picker
  try {
    await expect(page).toHaveURL(/\/(my-items|reports-history|forms|dashboard)/, { timeout: 20000 });
  } catch {
    // org picker — click select button
    const orgBtn = page.getByTestId('select-organization-org-e2e-main');
    await orgBtn.waitFor({ state: 'visible', timeout: 15000 });
    await orgBtn.click();
    await expect(page).toHaveURL(/\/(my-items|reports-history|forms)/, { timeout: 20000 });
  }
  await pause(1500);

  // ── Step 2: Create a Check-Out form (3 Safety Helmets) ───────────────────
  await clickNavLink(page, 'create-form');
  await page.getByTestId('create-form-page').waitFor({ state: 'visible', timeout: 15000 });
  await pause(1000);

  // Wait for warehouse inventory to load
  await page.getByTestId('create-form-loading-overlay')
    .waitFor({ state: 'hidden', timeout: 30000 })
    .catch(() => {});

  // Select user "E2E Customer"
  const userSelect = page.getByTestId('create-form-user-select');
  await userSelect.locator('.ng-select-container').click();
  const filterInput = userSelect.locator('input').first();
  await filterInput.fill('customer');
  await pause(500);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await pause(800);

  // Fill description
  await page.getByTestId('create-form-description-input').fill(DESCRIPTION);
  await pause(400);

  // Fill item row (should already have one empty row)
  const firstRow = page.getByTestId('editable-item-row').first();
  await firstRow.waitFor({ state: 'visible', timeout: 15000 });
  const productInput = firstRow.getByTestId('editable-item-product-input');
  await productInput.click();
  await productInput.fill('helmet');
  await pause(600);
  const helmetOption = page.locator('[data-testid="editable-item-product-option-prod-bulk-helmet"]').first();
  await helmetOption.waitFor({ state: 'visible', timeout: 10000 });
  await helmetOption.click();
  await pause(500);

  const quantityInput = firstRow.getByTestId('editable-item-quantity-input');
  await quantityInput.click({ clickCount: 3 });
  await quantityInput.fill('3');
  await pause(600);

  // Submit check-out form
  const submitBtn = page.getByTestId('editable-inventory-submit');
  await expect(submitBtn).toBeEnabled({ timeout: 15000 });
  await submitBtn.click();
  // Handle confirm dialog
  page.once('dialog', (d) => d.accept().catch(() => {}));
  await pause(2000);

  // ── Step 3: Go to Forms and Approve ─────────────────────────────────────
  await clickNavLink(page, 'forms');
  await expect(page).toHaveURL(/\/forms/, { timeout: 15000 });
  await pause(2000);

  // Show all statuses
  const statusFilter = page.getByTestId('forms-status-filter');
  await statusFilter.waitFor({ state: 'visible', timeout: 15000 });
  await statusFilter.click();
  const allOpt = page.locator('mat-option[value="all"]');
  await allOpt.waitFor({ state: 'visible', timeout: 5000 });
  await allOpt.click();
  await pause(800);

  // Search for our form
  const searchInput = page.getByTestId('forms-search-input');
  await searchInput.fill(DESCRIPTION);
  await pause(1500);

  const formCard = page.locator('[data-testid^="form-card-"]').filter({ hasText: DESCRIPTION }).first();
  await formCard.waitFor({ state: 'visible', timeout: 20000 });
  await pause(1000);

  // Approve
  await formCard.locator('[data-testid^="form-approve-"]').click();
  await pause(1000);
  await drawSignature(page);
  await pause(600);

  const approveOk = page.getByTestId('signature-dialog-approve');
  await expect(approveOk).toBeEnabled({ timeout: 8000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/forms/approve') && r.ok(), { timeout: 30000 }),
    approveOk.click(),
  ]);
  await pause(2500);

  // Switch filter to All and search again to see approved form
  await statusFilter.click();
  await allOpt.waitFor({ state: 'visible', timeout: 5000 });
  await allOpt.click();
  await pause(500);
  await searchInput.clear();
  await searchInput.fill(DESCRIPTION);
  await pause(1500);

  const approvedCard = page.locator('[data-testid^="form-card-"]').filter({ hasText: DESCRIPTION }).first();
  await expect(approvedCard.locator('[data-testid^="form-status-"]')).toHaveClass(/approved/, { timeout: 15000 });
  await expect(approvedCard.getByTestId('badge-not-returned')).toBeVisible({ timeout: 15000 });
  await pause(2000);

  // ── Step 4: Partial Check-In — return 1 of 3 helmets ─────────────────────
  const checkInBtn = approvedCard.locator('[data-testid^="form-checkin-"]');
  await checkInBtn.waitFor({ state: 'visible', timeout: 10000 });
  await checkInBtn.click();
  await pause(1200);

  const dialog1 = page.getByTestId('check-in-dialog-content');
  await dialog1.waitFor({ state: 'visible', timeout: 12000 });
  await pause(800);

  // Fill item row: select product then set quantity to 1 (partial return)
  const itemRow1 = page.getByTestId('editable-item-row').first();
  await itemRow1.waitFor({ state: 'visible', timeout: 10000 });
  const prodInput1 = itemRow1.getByTestId('editable-item-product-input');
  await prodInput1.click();
  await prodInput1.fill('helmet');
  await pause(600);
  const helmetOpt1 = page.locator('[data-testid="editable-item-product-option-prod-bulk-helmet"]').first();
  await helmetOpt1.waitFor({ state: 'visible', timeout: 8000 });
  await helmetOpt1.click();
  await pause(500);
  const qty1 = itemRow1.getByTestId('editable-item-quantity-input');
  await qty1.click({ clickCount: 3 });
  await qty1.fill('1');
  await pause(600);

  await drawSignature(page);
  await pause(600);

  const submitCI1 = page.getByTestId('editable-inventory-submit');
  await expect(submitCI1).toBeEnabled({ timeout: 10000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/check-in') && r.ok(), { timeout: 30000 }),
    submitCI1.click(),
  ]);
  await pause(3000);

  // Verify partially returned badge
  await expect(approvedCard.getByTestId('badge-partially-returned')).toBeVisible({ timeout: 15000 });
  await pause(2500);

  // ── Step 5: Full Check-In — return remaining 2 helmets ───────────────────
  await checkInBtn.waitFor({ state: 'visible', timeout: 10000 });
  await checkInBtn.click();
  await pause(1200);

  const dialog2 = page.getByTestId('check-in-dialog-content');
  await dialog2.waitFor({ state: 'visible', timeout: 12000 });
  await pause(800);

  // Fill item row: product + quantity 2
  const itemRow2 = page.getByTestId('editable-item-row').first();
  await itemRow2.waitFor({ state: 'visible', timeout: 10000 });
  const prodInput2 = itemRow2.getByTestId('editable-item-product-input');
  await prodInput2.click();
  await prodInput2.fill('helmet');
  await pause(600);
  const helmetOpt2 = page.locator('[data-testid="editable-item-product-option-prod-bulk-helmet"]').first();
  await helmetOpt2.waitFor({ state: 'visible', timeout: 8000 });
  await helmetOpt2.click();
  await pause(500);
  const qty2 = itemRow2.getByTestId('editable-item-quantity-input');
  await qty2.click({ clickCount: 3 });
  await qty2.fill('2');
  await pause(600);

  await drawSignature(page);
  await pause(600);

  const submitCI2 = page.getByTestId('editable-inventory-submit');
  await expect(submitCI2).toBeEnabled({ timeout: 10000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/check-in') && r.ok(), { timeout: 30000 }),
    submitCI2.click(),
  ]);
  await pause(3000);

  // Verify fully returned
  await expect(approvedCard.getByTestId('badge-fully-returned')).toBeVisible({ timeout: 15000 });
  await pause(3000);
});
