import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

const baseURL = process.env['BASE_URL'];
const backendBaseURL = process.env['BACKEND_BASE_URL'];

if (!baseURL) {
  throw new Error('BASE_URL is required for deployed Playwright config');
}

if (!backendBaseURL) {
  throw new Error('BACKEND_BASE_URL is required for deployed Playwright config');
}

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
