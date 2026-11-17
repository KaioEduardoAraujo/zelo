import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  criarConta,
  entrar,
  esperarAssistentePronto,
  semearProposta,
  service,
  zerarLimitesDeTaxa,
} from "./support";

test.beforeEach(async () => {
  await zerarLimitesDeTaxa();
});

async function semViolacoes(page: Page, nome: string) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const resumo = r.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(resumo, `violações de acessibilidade em ${nome}`).toEqual([]);
}

test("telas públicas: login, cadastro, recuperação e verificação", async ({ page }) => {
  for (const rota of ["/login", "/cadastro", "/esqueci-senha", "/verificar"]) {
    await page.goto(rota);
    await semViolacoes(page, rota);
  }
  await page.getByLabel("Código do comprovante").fill("ZL-2222-2222");
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByRole("heading", { name: "Não encontrado" })).toBeVisible();
  await semViolacoes(page, "/verificar (resultado)");
});

test("página do cliente: aberta (com a folha de aceite) e já aceita", async ({ page }) => {
  const conta = await criarConta({ nome: "Carlos Andrade" });
  const aberta = await semearProposta(conta.id, { status: "enviada" });
  await page.goto(`/p/${aberta.token}`);
  await expect(page.getByRole("button", { name: "Aceitar proposta" })).toBeEnabled();
  await semViolacoes(page, "/p (aberta)");

  await page.getByRole("button", { name: "Aceitar proposta" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await semViolacoes(page, "/p (folha de aceite)");

  const aceita = await semearProposta(conta.id, { status: "aceita" });
  await page.goto(`/p/${aceita.token}`);
  await semViolacoes(page, "/p (aceita)");

  await page.goto("/p/link-que-nao-existe");
  await semViolacoes(page, "/p (link inválido)");
});

test("área do prestador: painel, listagem, detalhe, assistente, entrega e modelos", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const conta = await criarConta({ nome: "Carlos Andrade" });
  const aceita = await semearProposta(conta.id, { status: "aceita" });
  const rascunho = await semearProposta(conta.id, { status: "rascunho" });
  await entrar(page, conta.email, conta.password);
  await expect(page).toHaveURL(/\/inicio/);
  await semViolacoes(page, "/inicio");

  for (const rota of [
    "/propostas",
    `/propostas/${aceita.id}`,
    "/propostas/nova",
    "/templates",
    "/conta",
  ]) {
    await page.goto(rota);
    await semViolacoes(page, rota);
  }

  await page.goto(`/propostas/${rascunho.id}/editar?etapa=2`);
  await esperarAssistentePronto(page);
  await semViolacoes(page, "assistente, etapa 2");
  await page.goto(`/propostas/${rascunho.id}/editar?etapa=4`);
  await esperarAssistentePronto(page);
  await semViolacoes(page, "assistente, etapa 4");

  const { data: e } = await service
    .from("propostas")
    .insert({
      prestador_id: conta.id,
      tipo: "entrega",
      proposta_pai_id: aceita.id,
      cliente_nome: "Rafael Lima",
      cliente_email: "rafael@example.com",
      titulo: "Entrega: Troca de tela",
    })
    .select("id")
    .single();
  await service.from("proposta_versoes").insert({
    proposta_id: e!.id,
    numero: 1,
    conteudo: {
      resumo: "",
      checklist: [{ texto: "Tela trocada", feito: false }],
      fotos: [],
      validade_dias: 15,
    },
  });
  await page.goto(`/propostas/${e!.id}/editar`);
  await expect(page.getByRole("button", { name: "Enviar entrega" })).toBeEnabled({
    timeout: 30_000,
  });
  await semViolacoes(page, "editor de entrega");
});

test("área do administrador", async ({ page }) => {
  const admin = await criarConta({ nome: "Admin Zelo", admin: true });
  await entrar(page, admin.email, admin.password);
  await expect(page).toHaveURL(/\/admin$/);
  await semViolacoes(page, "/admin");
  await page.goto("/admin/templates");
  await semViolacoes(page, "/admin/templates");
});
