import { defineConfig, devices } from '@playwright/test';
const basePath = process.env.CALIFY_BASE_PATH ?? '/calify/pr-4';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  use: { baseURL: `http://127.0.0.1:3100${basePath}/`, trace: 'retain-on-failure' },
  webServer: { command: 'pnpm build && pnpm start --port 3100', url: `http://127.0.0.1:3100${basePath}`, timeout: 180_000, env: { CALIFY_BASE_PATH: basePath }, reuseExistingServer: false },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
