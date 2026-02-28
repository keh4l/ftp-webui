import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: ".sisyphus/evidence/playwright-report", open: "never" }]],
  outputDir: ".sisyphus/evidence/playwright-output",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "PLAYWRIGHT_TEST=1 APP_MASTER_KEY=test-key-for-build ADMIN_USERNAME=admin ADMIN_PASSWORD=test-pass pnpm dev",
    url: "http://127.0.0.1:3001/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
