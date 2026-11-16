import { defineConfig, devices } from "@playwright/test";

/*
 * Testes de ponta a ponta (navegador real) contra o app local + Supabase local.
 * Localmente usa o Google Chrome instalado (channel "chrome"); na CI (Fase 10) o
 * Chromium do Playwright.
 */
// Porta 3000: se o `npm run dev` já estiver rodando, ele é reaproveitado (o Next 16 não
// permite dois `next dev` na mesma pasta).
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // O `next dev` compila sob demanda e é bem mais lento que a produção: poucos workers e
  // esperas mais longas evitam falsos negativos por máquina carregada.
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
