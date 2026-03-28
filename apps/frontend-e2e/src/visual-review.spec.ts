import { test, expect } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import { mintE2eJwt } from './helpers/e2e-auth';
import {
  bootstrapAuthenticatedSession,
  ensureOrganizationIsSelected,
} from './helpers/e2e-navigation';

const backendBaseUrl =
  process.env['BACKEND_BASE_URL'] || 'http://localhost:3000';
const e2eSecret = process.env['E2E_AUTH_SECRET'] || 'e2e-local-secret';
const organizationId = 'org-e2e-main';

/** Comma-separated paths, e.g. `/my-items,/forms`. Leading slash optional. */
function getRoutes(): string[] {
  const raw = process.env['VISUAL_REVIEW_ROUTES'];
  if (raw?.trim()) {
    return raw
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => (r.startsWith('/') ? r : `/${r}`));
  }
  return ['/my-items'];
}

test.describe('visual review screenshots', () => {
  test('capture full-page PNGs for agent / designer review', async ({
    page,
    request,
  }) => {
    const routes = getRoutes();

    const jwt = await mintE2eJwt(request, {
      backendBaseUrl,
      e2eSecret,
      userId: 'user-e2e-admin',
      orgIdToRole: {
        [organizationId]: UserRole.Admin,
      },
    });

    await bootstrapAuthenticatedSession(page, jwt, organizationId);
    await ensureOrganizationIsSelected(page, organizationId);

    for (const path of routes) {
      await page.goto(path, { waitUntil: 'load' });
      const safeName =
        path.replace(/^\/+/, '').replace(/\//g, '_') || 'root';
      await page.screenshot({
        path: `test-results/visual-review/${safeName}.png`,
        fullPage: true,
      });
    }

    expect(routes.length).toBeGreaterThan(0);
  });
});
