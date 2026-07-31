import { defineConfig, devices } from '@playwright/test';

const localBrowserChannel = process.env.CODEXRAY_E2E_CHANNEL as
  | 'chrome'
  | 'msedge'
  | undefined;

export default defineConfig({
  testDir: './e2e',
  testIgnore: process.env.CODEXRAY_REAL_AI === '1'
    ? '**/real-radio.spec.ts'
    : process.env.CODEXRAY_REAL_RADIO === '1'
      ? '**/real-ai.spec.ts'
      : '**/real-*.spec.ts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    ...(localBrowserChannel ? { channel: localBrowserChannel } : {}),
  },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
