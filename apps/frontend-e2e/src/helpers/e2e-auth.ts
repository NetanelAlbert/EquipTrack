import { APIRequestContext, expect, Page } from '@playwright/test';
import { UserRole } from '@equip-track/shared';
import {
  E2E_LANGUAGE_STORAGE_KEY,
  E2E_TEST_APP_LANGUAGE,
} from './e2e-locale';

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

export async function mintE2eJwt(
  request: APIRequestContext,
  options: E2eAuthOptions
): Promise<string> {
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

  return payload.jwt;
}

export async function authenticateWithE2eToken(
  page: Page,
  request: APIRequestContext,
  options: E2eAuthOptions
): Promise<void> {
  const jwt = await mintE2eJwt(request, options);

  await page.addInitScript(
    ({
      jwtToken,
      languageKey,
      languageValue,
    }: {
      jwtToken: string;
      languageKey: string;
      languageValue: string;
    }) => {
      window.localStorage.setItem('equip-track-token', jwtToken);
      window.localStorage.setItem(languageKey, languageValue);
    },
    {
      jwtToken: jwt,
      languageKey: E2E_LANGUAGE_STORAGE_KEY,
      languageValue: E2E_TEST_APP_LANGUAGE,
    }
  );
}
