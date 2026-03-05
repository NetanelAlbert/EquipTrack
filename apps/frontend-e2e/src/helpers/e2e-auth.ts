import { APIRequestContext, expect, Page } from '@playwright/test';
import { UserRole } from '@equip-track/shared';

interface E2eAuthOptions {
  backendBaseUrl: string;
  e2eSecret: string;
  userId: string;
  orgIdToRole: Record<string, UserRole>;
}

interface E2eAuthResponse {
  status: boolean;
  jwt: string;
}

export async function authenticateWithE2eToken(
  page: Page,
  request: APIRequestContext,
  options: E2eAuthOptions
): Promise<void> {
  const response = await request.post(
    `${options.backendBaseUrl}/api/auth/e2e-login`,
    {
      headers: {
        'x-e2e-secret': options.e2eSecret,
      },
      data: {
        userId: options.userId,
        orgIdToRole: options.orgIdToRole,
      },
    }
  );

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as E2eAuthResponse;
  expect(payload.status).toBeTruthy();
  expect(payload.jwt).toBeTruthy();

  await page.addInitScript((jwtToken: string) => {
    window.localStorage.setItem('equip-track-token', jwtToken);
  }, payload.jwt);
}
