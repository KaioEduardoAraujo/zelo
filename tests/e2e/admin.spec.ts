import { expect, test } from "@playwright/test";

import { criarConta, entrar, semRolagemHorizontal, semearProposta, service } from "./support";

test.describe("prestadores", () => {
  test("lista com contagens, filtra, suspende e reativa (e o login acompanha)", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "área do admin é desktop; 375px testado abaixo");
    test.setTimeout(150_000);
    const admin = await criarConta({ nome: "Admin Zelo", admin: true });
    const nome = `Zuleica ${Date.now()}`; // único: o banco local guarda contas de execuções anteriores
    const alvo = await criarConta({ nome });
    const proposta = await semearProposta(alvo.id, { status: "aceita" });
    await semearProposta(alvo.id, { status: "enviada" });

    await entrar(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByLabel("Buscar por nome, empresa ou e-mail").fill(nome);
    await page.getByRole("button", { name: "Filtrar" }).click();
    const linha = page.getByRole("row", { name: new RegExp(nome) });
    await expect(linha).toBeVisible();
    await expect(linha.getByRole("cell").nth(2)).toHaveText("2");
    await expect(linha.getByRole("cell").nth(3)).toHaveText("1");
    await expect(linha.getByText("✓ Ativa")).toBeVisible();
    await expect(page.getByRole("row", { name: /Admin Zelo/ })).toHaveCount(0);

    await linha.getByRole("button", { name: /Suspender/ }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText(/links que já enviou continuam valendo/)).toBeVisible();
    await dialogo.getByRole("button", { name: "Suspender conta" }).click();
    await expect(
      page.getByText(/Conta suspensa\. O prestador não consegue mais entrar/),
    ).toBeVisible();
    await page.getByLabel("Situação").selectOption("suspensos");
    await page.getByLabel("Buscar por nome, empresa ou e-mail").fill(nome);
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(nome) }).getByText("✕ Suspensa"),
    ).toBeVisible();

    // Banco e Auth: perfil inativo E usuário banido
    const { data: perfil } = await service
      .from("profiles")
      .select("ativo")
      .eq("id", alvo.id)
      .single();
    expect(perfil?.ativo).toBe(false);
    const { data: u } = await service.auth.admin.getUserById(alvo.id);
    expect(u.user?.banned_until).toBeTruthy();

    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await entrar(p, alvo.email, alvo.password);
    await expect(p.getByText(/Sua conta está suspensa/)).toBeVisible();
    await expect(p).toHaveURL(/\/login/);

    // Links já enviados continuam valendo para o cliente
    await p.goto(`/p/${proposta.token}`);
    await expect(p.getByText("Aceita por", { exact: false })).toBeVisible();
    await ctx.close();

    await page
      .getByRole("row", { name: new RegExp(nome) })
      .getByRole("button", { name: /Reativar/ })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Reativar conta" }).click();
    await expect(page.getByText(/Conta reativada/)).toBeVisible();
    const { data: depois } = await service.auth.admin.getUserById(alvo.id);
    expect(depois.user?.banned_until ?? null).toBeNull();

    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await entrar(p2, alvo.email, alvo.password);
    await expect(p2).toHaveURL(/\/inicio/);
    await ctx2.close();
  });

  test("totais gerais e 375px sem rolagem horizontal da página", async ({ page }) => {
    const admin = await criarConta({ nome: "Admin Zelo", admin: true });
    await entrar(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Aceites registrados")).toBeVisible();
    await expect(page.getByText("Contas suspensas")).toBeVisible();
    await semRolagemHorizontal(page);
  });

  test("prestador não acessa nem as telas novas do admin", async ({ page }) => {
    const conta = await criarConta();
    await entrar(page, conta.email, conta.password);
    await expect(page).toHaveURL(/\/inicio/);
    for (const rota of ["/admin", "/admin/templates"]) {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/inicio/);
    }
  });
});

test.describe("templates globais", () => {
  test("cria, preenche, ativa (aparece para o prestador), desativa e exclui", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "área do admin é desktop");
    test.setTimeout(150_000);
    const admin = await criarConta({ nome: "Admin Zelo", admin: true });
    const titulo = `Modelo de teste ${Date.now()}`;
    await entrar(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/templates");

    await page.getByRole("button", { name: "Novo modelo" }).click();
    await expect(page).toHaveURL(/\/admin\/templates\/[0-9a-f-]{36}\/editar$/);
    const id = page.url().match(/templates\/([0-9a-f-]{36})\//)![1];

    await page.goto("/admin/templates");
    await page
      .getByRole("article")
      .filter({ hasText: "Novo modelo" })
      .getByRole("button", { name: /Ativar/ })
      .first()
      .click();
    await expect(page.getByText(/Preencha o modelo por completo antes de ativá-lo/)).toBeVisible();

    await service
      .from("templates")
      .update({
        conteudo: {
          escopo: "Serviço completo, com mão de obra e materiais combinados.",
          itens: [
            { descricao: "Serviço", unidade: "vb", quantidade: 1, valor_unitario_centavos: 50_000 },
          ],
          exclusoes: [],
          valor_total_centavos: 50_000,
          prazo: "3 dias",
          pagamento: "Pix",
          garantia: "30 dias",
          validade_dias: 10,
        },
      })
      .eq("id", id);
    await page.goto(`/admin/templates/${id}/editar`);
    await page.getByLabel(/Nome do modelo/).fill(titulo);
    await page.getByRole("button", { name: /Salvar/ }).click();
    await expect(page).toHaveURL(/\/admin\/templates$/);
    await expect(page.getByRole("heading", { name: titulo })).toBeVisible();

    await page
      .getByRole("article")
      .filter({ hasText: titulo })
      .getByRole("button", { name: /Ativar/ })
      .click();
    await expect(
      page.getByRole("article").filter({ hasText: titulo }).getByText("✓ Ativo"),
    ).toBeVisible();

    const prest = await criarConta();
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await entrar(p, prest.email, prest.password);
    await expect(p).toHaveURL(/\/inicio/);
    await p.goto("/templates");
    await expect(p.getByRole("heading", { name: titulo })).toBeVisible();
    await expect(p.getByRole("link", { name: /^Editar/ }).filter({ hasText: titulo })).toHaveCount(
      0,
    );

    await page
      .getByRole("article")
      .filter({ hasText: titulo })
      .getByRole("button", { name: /Desativar/ })
      .click();
    await p.reload();
    await expect(p.getByRole("heading", { name: titulo })).toHaveCount(0);
    await ctx.close();

    await page
      .getByRole("article")
      .filter({ hasText: titulo })
      .getByRole("button", { name: /Excluir/ })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Excluir modelo" }).click();
    await expect(page.getByText("Modelo excluído.")).toBeVisible();
    await expect(page.getByRole("heading", { name: titulo })).toHaveCount(0);
  });
});
