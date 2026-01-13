import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const useExistingServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const isLocalBaseURL = baseURL.includes('127.0.0.1') || baseURL.includes('localhost');

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'reports/playwright', open: 'never' }]],
  use: {
    baseURL,
    headless: isCI,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(useExistingServer || !isLocalBaseURL
    ? {}
    : {
        webServer: {
          command: 'NEXTAUTH_URL=http://127.0.0.1:3000 NEXTAUTH_SECRET=playwright-local-secret npm run dev -- --hostname 127.0.0.1 --port 3000',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 300 * 1000,
        },
      }),
});
