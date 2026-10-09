import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  webServer:
    process.env.FILEWORK_PRODUCTION_URL || process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : {
          command: `"${process.execPath}" "${path.resolve('node_modules/vite/bin/vite.js')}" --host 127.0.0.1 --port 5173 --strictPort`,
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: true,
          timeout: 60_000,
        },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  reporter: 'list',
});
