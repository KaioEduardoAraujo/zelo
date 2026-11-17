import { defineConfig, devices } from "@playwright/test";

// Porta 3000: reaproveita o npm run dev (o Next 16 não roda dois next dev na mesma pasta).
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // next dev é lento: poucos workers e esperas mais longas.
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 375, height: 740 },
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
