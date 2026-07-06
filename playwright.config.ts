import { defineConfig } from '@playwright/test';

const reuseExistingServer = !process.env.CI;

export default defineConfig({
  expect: {
    timeout: 7000,
  },
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1',
      reuseExistingServer,
      timeout: 120000,
      url: 'http://127.0.0.1:5173',
    },
    {
      command: 'npm run online:server',
      reuseExistingServer,
      timeout: 120000,
      url: 'http://127.0.0.1:8787/health',
    },
  ],
});
