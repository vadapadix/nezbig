import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  globalTimeout: 120000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    }
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:8787',
    reuseExistingServer: !process.env.CI,
    env: { NODE_ENV: 'production', JWT_SECRET: 'e2e-only-6b76a7dd54254853a41305cf58fb8c62', CLIENT_URL: 'https://localhost', NEZBIG_DATA_DIR: '.tmp/playwright-data' },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
