import { expect, test } from "@playwright/test";

import { criarConta, entrar, novaSenha, novoEmail, service, ultimoEmailPara } from "./support";

test.describe("proteção de rotas", () => {
  test("visitante é levado ao login e volta para onde queria depois de entrar", async ({
    page,
  }) => {
    const conta = await criarConta();
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/login\?next=%2Finicio/);

    await page.getByLabel("E-mail").fill(conta.email);
    await page.getByLabel("Senha", { exact: true }).fill(conta.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/inicio$/);
  });

  test("prestador não entra na área do admin", async ({ page }) => {
    const conta = await criarConta();
    await entrar(page, conta.email, conta.password);
    await expect(page).toHaveURL(/\/inicio/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/inicio/);
  });

  test("admin cai na área dele", async ({ page }) => {
    const admin = await criarConta({ nome: "Admin Zelo", admin: true });
    await entrar(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
  });

  test("logado não vê a tela de login", async ({ page }) => {
    const conta = await criarConta();
    await entrar(page, conta.email, conta.password);
    await expect(page).toHaveURL(/\/inicio/);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/inicio/);
  });

  test("next externo é ignorado (sem redirecionamento aberto)", async ({ page }) => {
    const conta = await criarConta();
    await entrar(page, conta.email, conta.password, "/login?next=https%3A%2F%2Fexample.com");
    await expect(page).toHaveURL(/localhost:\d+\/inicio$/);
  });
});

test.describe("cadastro, login e logout", () => {
  test("cadastro cria a conta como prestador e abre o painel", async ({ page }) => {
    const email = novoEmail();
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Ana Souza");
    await page.getByLabel(/Nome da empresa/).fill("Souza Design");
    await page.getByLabel(/WhatsApp com DDD/).fill("(11) 98765-4321");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill("senha1234");
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible();

    const { data } = await service
      .from("profiles")
      .select("role, telefone, empresa_nome")
      .eq("email", email)
      .single();
    expect(data).toEqual({
      role: "prestador",
      telefone: "11987654321",
      empresa_nome: "Souza Design",
    });

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/login/);
  });

  test("cadastro mostra erros por campo e mantém o que foi digitado", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Ana Souza");
    await page.getByLabel("E-mail").fill("ana-sem-arroba");
    await page.getByLabel("Senha", { exact: true }).fill("curta");
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page.getByText("Confira o e-mail: parece que falta alguma parte.")).toBeVisible();
    await expect(page.getByText("Use pelo menos 8 caracteres.")).toBeVisible();
    await expect(page.getByLabel("Seu nome")).toHaveValue("Ana Souza");
    await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
  });

  test("senha errada mostra mensagem genérica", async ({ page }) => {
    const conta = await criarConta();
    await entrar(page, conta.email, "senhaErrada123");
    await expect(page.locator("main").getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
    await expect(page.getByLabel("E-mail")).toHaveValue(conta.email);
  });
});

test.describe("conta suspensa", () => {
  test("não consegue entrar", async ({ page }) => {
    const conta = await criarConta({ suspensa: true });
    await entrar(page, conta.email, conta.password);
    await expect(page.locator("main").getByRole("alert")).toContainText("Sua conta está suspensa");
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/login/);
  });

  test("suspensa durante a sessão é barrada no próximo acesso", async ({ page }) => {
    const conta = await criarConta();
    await entrar(page, conta.email, conta.password);
    await expect(page).toHaveURL(/\/inicio/);

    await service.from("profiles").update({ ativo: false }).eq("id", conta.id);
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/conta-suspensa$/);
    await expect(page.getByRole("heading", { name: "Sua conta está suspensa" })).toBeVisible();
  });
});

test.describe("esqueci a senha", () => {
  test("recebe o link por e-mail, cria nova senha e entra com ela", async ({ page }) => {
    const conta = await criarConta();
    await page.goto("/esqueci-senha");
    await page.getByLabel("E-mail").fill(conta.email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("status")).toContainText("Se houver uma conta com esse e-mail");

    const email = await ultimoEmailPara(conta.email);
    expect(email.subject).toBe("Crie uma nova senha no Zelo");
    const link = email.html.match(/href="([^"]*\/auth\/confirm\?[^"]+)"/)?.[1];
    expect(link).toBeTruthy();
    // O link aponta para o site_url configurado; trocamos a origem pela do servidor de teste.
    const url = new URL(link!.replaceAll("&amp;", "&"));
    await page.goto(`${url.pathname}${url.search}`);
    await expect(page).toHaveURL(/\/redefinir-senha$/);

    const nova = novaSenha();
    await page.getByLabel("Nova senha", { exact: true }).fill(nova);
    await page.getByLabel("Repita a nova senha").fill(nova);
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page).toHaveURL(/\/inicio\?senha=redefinida/);
    await expect(page.getByText("Senha alterada.")).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await entrar(page, conta.email, nova);
    await expect(page).toHaveURL(/\/inicio/);
  });

  test("e-mail não cadastrado recebe a mesma resposta", async ({ page }) => {
    await page.goto("/esqueci-senha");
    await page.getByLabel("E-mail").fill(novoEmail());
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("status")).toContainText("Se houver uma conta com esse e-mail");
  });

  test("link adulterado é recusado", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=abcdefghijklmnop&type=recovery");
    await expect(page).toHaveURL(/\/login\?erro=link-invalido/);
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Este link expirou ou já foi usado",
    );
  });
});
