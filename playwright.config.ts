import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 800 } } }],
  // Build with CAS_PARSER_DEV_URL=http://127.0.0.1:5328 so /api/cas_parse
  // reaches the local statement reader below.
  webServer: [
    {
      command: "npm run start",
      url: "http://localhost:3000/login",
      reuseExistingServer: true,
      timeout: 120_000,
      // AI calls go to the fake OpenRouter below.
      env: {
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_BASE_URL: "http://127.0.0.1:5329/api/v1",
      },
    },
    {
      command: "node tests/e2e/fake-openrouter.mjs",
      port: 5329,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: ".venv-cas/bin/python scripts/cas_dev_server.py",
      port: 5328,
      reuseExistingServer: true,
      timeout: 60_000,
      env: { CAS_FAKE_FIXTURE: "tests/e2e/fixtures/cas-statement.json" },
    },
  ],
});
