import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    port: 3000,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_PATH: process.env.TEST_DATABASE_PATH ?? "/tmp/playwright-connector.db",
      SESSION_SECRET: "playwright-test-secret",
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY ?? "",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
