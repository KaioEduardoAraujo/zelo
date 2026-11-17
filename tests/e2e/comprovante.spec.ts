import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  criarConta,
  entrar,
  semRolagemHorizontal,
  semearProposta,
  service,
  zerarLimitesDeTaxa,
} from "./support";

test.beforeEach(async () => {
  await zerarLimitesDeTaxa();
});

async function aceiteDe(versaoId: string) {
  const { data } = await service
    .from("aceites")
    .select("id, codigo_comprovante, pdf_path")
    .eq("versao_id", versaoId)
    .single();
  return data!;
}

test("prestador baixa o comprovante e qualquer pessoa confere em /verificar", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const conta = await criarConta({ nome: "Carlos Andrade" });
  const s = await semearProposta(conta.id, { status: "aceita", cliente: "Mariana Costa" });
  const aceite = await aceiteDe(s.versaoId);

  await entrar(page, conta.email, conta.password);
  await expect(page).toHaveURL(/\/inicio/);
  await page.goto(`/propostas/${s.id}`);
  await expect(page.getByText(aceite.codigo_comprovante)).toBeVisible();
  await expect(page.getByText("Aceita por Mariana Costa (CPF ***.982.247-**).")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Baixar comprovante (PDF)" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`comprovante-${aceite.codigo_comprovante}.pdf`);
  const caminhoPdf = (await download.path())!;
  const pdf = readFileSync(caminhoPdf);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  // Gerado uma vez só: baixar de novo devolve o mesmo arquivo e não gera outro evento
  const [download2] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Baixar comprovante (PDF)" }).click(),
  ]);
  expect(readFileSync((await download2.path())!).equals(pdf)).toBe(true);
  const { data: eventos } = await service
    .from("auditoria_eventos")
    .select("tipo")
    .eq("proposta_id", s.id)
    .eq("tipo", "pdf_gerado");
  expect(eventos).toHaveLength(1);

  // Outro prestador não baixa o comprovante alheio (mesma resposta de "não existe")
  const outra = await criarConta({ nome: "Outro Prestador" });
  const contexto = await browser.newContext();
  const intruso = await contexto.newPage();
  await entrar(intruso, outra.email, outra.password);
  await expect(intruso).toHaveURL(/\/inicio/);
  const r = await intruso.request.get(`/propostas/${s.id}/comprovante`, { maxRedirects: 0 });
  expect(r.status()).toBe(404);
  await contexto.close();

  const anonimo = await browser.newContext();
  const v = await anonimo.newPage();
  await v.goto(`/verificar?codigo=${aceite.codigo_comprovante}`);
  await expect(v.getByLabel("Código do comprovante")).toHaveValue(aceite.codigo_comprovante);
  await v.getByRole("button", { name: "Verificar" }).click();
  await expect(v.getByRole("heading", { name: "Documento íntegro" })).toBeVisible();
  await expect(v.getByText(s.hash!)).toBeVisible();
  // Nada do cliente aparece para quem só tem o código (LGPD)
  await expect(v.getByText("Mariana Costa")).toHaveCount(0);
  await expect(v.getByText(/982\.247/)).toHaveCount(0);

  await v.getByLabel("Arquivo do comprovante (PDF)").setInputFiles(caminhoPdf);
  await v.getByRole("button", { name: "Verificar" }).click();
  await expect(
    v.getByText("O arquivo enviado é idêntico ao comprovante original emitido pelo Zelo."),
  ).toBeVisible();

  await v.getByLabel("Arquivo do comprovante (PDF)").setInputFiles({
    name: "editado.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([pdf, Buffer.from(" ")]),
  });
  await v.getByRole("button", { name: "Verificar" }).click();
  await expect(v.getByText(/O arquivo enviado NÃO é igual ao comprovante original/)).toBeVisible();
  await anonimo.close();
});

test("/verificar: código inexistente, formato errado e digitação solta", async ({
  page,
  isMobile,
}) => {
  await page.goto("/verificar");
  const campo = page.getByLabel("Código do comprovante");
  const verificar = page.getByRole("button", { name: "Verificar" });
  await expect(verificar).toBeEnabled();

  await campo.fill("abc");
  await verificar.click();
  await expect(page.getByText("Confira o código: ele tem o formato ZL-XXXX-XXXX.")).toBeVisible();

  await campo.fill("ZL-2222-2222");
  await verificar.click();
  await expect(page.getByRole("heading", { name: "Não encontrado" })).toBeVisible();

  const conta = await criarConta({ nome: "Carlos Andrade" });
  const s = await semearProposta(conta.id, { status: "aceita" });
  const aceite = await aceiteDe(s.versaoId);
  await campo.fill(aceite.codigo_comprovante.replace(/-/g, " ").toLowerCase());
  await verificar.click();
  await expect(page.getByRole("heading", { name: "Documento íntegro" })).toBeVisible();
  if (isMobile) await semRolagemHorizontal(page);
});

test("cliente baixa o comprovante pelo link depois de aceito; sem aceite não há comprovante", async ({
  page,
}) => {
  const conta = await criarConta({ nome: "Carlos Andrade" });
  const aceita = await semearProposta(conta.id, { status: "aceita" });
  const aceite = await aceiteDe(aceita.versaoId);

  await page.goto(`/p/${aceita.token}`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Baixar comprovante" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`comprovante-${aceite.codigo_comprovante}.pdf`);

  const enviada = await semearProposta(conta.id, { status: "enviada" });
  const r = await page.request.get(`/p/${enviada.token}/comprovante`, { maxRedirects: 0 });
  expect(r.status()).toBe(404);
  const lixo = await page.request.get(`/p/${"A".repeat(43)}/comprovante`, { maxRedirects: 0 });
  expect(lixo.status()).toBe(404);
});
