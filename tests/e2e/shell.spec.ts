import { expect, test, type Page } from "@playwright/test";

import { criarConta, entrar } from "./support";

/** Nenhuma rolagem horizontal (DESIGN.md: funciona em 375px). */
async function semRolagemHorizontal(page: Page) {
  const { scroll, viewport } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(scroll, `largura do conteúdo em ${page.url()}`).toBeLessThanOrEqual(viewport);
}

test("páginas públicas e vitrine não rolam para o lado", async ({ page }) => {
  for (const path of ["/", "/login", "/cadastro", "/esqueci-senha", "/dev/componentes"]) {
    await page.goto(path);
    await semRolagemHorizontal(page);
  }
});

test("shell do prestador: navegação, item ativo e sem rolagem lateral", async ({
  page,
  isMobile,
}) => {
  const conta = await criarConta({ nome: "Carlos Andrade" });
  await entrar(page, conta.email, conta.password);
  await expect(page).toHaveURL(/\/inicio/);

  const nav = page.getByRole("navigation", { name: "Principal" }).filter({ visible: true });
  await expect(nav).toHaveCount(1);

  for (const [label, path] of [
    ["Propostas", "/propostas"],
    ["Templates", "/templates"],
    ["Conta", "/conta"],
    ["Início", "/inicio"],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    await semRolagemHorizontal(page);
  }

  // Desktop: botão no topo da barra lateral · mobile: botão central da navegação inferior.
  await page.getByRole("link", { name: "Nova proposta" }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/propostas\/nova$/);

  if (isMobile) {
    // No celular, o título fica na barra superior; o H1 existe só para leitores de tela.
    await expect(page.getByRole("banner").getByText("Nova proposta")).toBeVisible();
  }
});

test("link 'Pular para o conteúdo' aparece no teclado", async ({ page, isMobile }) => {
  test.skip(isMobile, "navegação por teclado é verificada no desktop");
  const conta = await criarConta();
  await entrar(page, conta.email, conta.password);
  await expect(page).toHaveURL(/\/inicio/);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
});
