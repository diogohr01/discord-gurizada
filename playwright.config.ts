import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
  webServer: {
    command: "npm.cmd run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      LIVEKIT_URL: process.env.LIVEKIT_URL || "wss://invalid.local",
      LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || "test-api-key",
      LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || "test-api-secret-test-api-secret",
      MVP_ACCESS_CODE: process.env.MVP_ACCESS_CODE || "gurizada-e2e-code",
      MVP_SESSION_SECRET: process.env.MVP_SESSION_SECRET || "gurizada-e2e-session-secret-at-least-32-characters",
      NEXT_PUBLIC_APP_NAME: "Discord da Gurizada",
    },
  },
});
