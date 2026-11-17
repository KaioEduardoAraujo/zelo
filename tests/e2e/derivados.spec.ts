import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  criarConta,
  digitarEConfirmar,
  emailsPara,
  entrar,
  esperarAssistentePronto,
  novoEmail,
  pedirCodigo,
  semRolagemHorizontal,
  semearProposta,
  service,
  zerarLimitesDeTaxa,
} from "./support";

/*
 * Fase 8: aditivo e aceite de entrega. Os dois REUTILIZAM o fluxo da proposta (mesmas telas de
 * envio, página do cliente, OTP e comprovante); estes testes provam que o vínculo com a proposta
 * aceita, o texto de cada tipo e as fotos da entrega funcionam de ponta a ponta.
 */

test.beforeEach(async () => {
  await zerarLimitesDeTaxa();
});

// PNG 1×1 válido: o navegador o desenha num canvas e regrava como JPEG (compressão das fotos).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function prestador() {
  const conta = await criarConta({ nome: "Carlos Andrade" });
  await service
    .from("profiles")
    .update({ empresa_nome: "Andrade Reformas", telefone: "11912345678" })
    .eq("id", conta.id);
  return conta;
}

async function login(page: Page, conta: { email: string; password: string }) {
  await entrar(page, conta.email, conta.password);
  await expect(page).toHaveURL(/\/inicio/);
}

/** O link aparece na mensagem da tela "criada". Devolve só o caminho (/p/<token>). */
async function lerCaminho(page: Page) {
  const mensagem = await page
    .getByText(/\/p\/[A-Za-z0-9_-]{43}/)
    .first()
    .innerText();
  const m = mensagem.match(/\/p\/([A-Za-z0-9_-]{43})/);
  expect(m, "link na mensagem").not.toBeNull();
  return `/p/${m![1]}`;
}

async function filho(paiId: string, tipo: "aditivo" | "entrega") {
  const { data } = await service
    .from("propostas")
    .select("id, tipo, proposta_pai_id, titulo, status")
    .eq("proposta_pai_id", paiId)
    .eq("tipo", tipo)
    .single();
  return data!;
}

async function versaoDe(propostaId: string) {
  const { data } = await service
    .from("proposta_versoes")
    .select("id, conteudo, hash_sha256")
    .eq("proposta_id", propostaId)
    .eq("numero", 1)
    .single();
  return data!;
}

test.describe("aditivo", () => {
  test("nasce da proposta aceita, é enviado, aceito pelo cliente e prova a referência", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "fluxo longo; o celular é coberto pelo teste de 375px mais abaixo");
    test.setTimeout(180_000);
    const conta = await prestador();
    const clienteEmail = novoEmail();
    const pai = await semearProposta(conta.id, {
      status: "aceita",
      titulo: "Troca de tela iPhone 12",
      cliente: "Rafael Lima",
      clienteEmail,
    });

    await login(page, conta);
    await page.goto(`/propostas/${pai.id}`);

    // Só a proposta ACEITA oferece aditivo e entrega
    await expect(page.getByRole("button", { name: "Novo aditivo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar entrega" })).toBeVisible();
    const aindaEnviada = await semearProposta(conta.id, { status: "enviada" });
    await page.goto(`/propostas/${aindaEnviada.id}`);
    await expect(page.getByRole("button", { name: "Novo aditivo" })).toHaveCount(0);
    await page.goto(`/propostas/${pai.id}`);

    await page.getByRole("button", { name: "Novo aditivo" }).click();
    await expect(page).toHaveURL(/\/propostas\/[0-9a-f-]{36}\/editar\?etapa=2$/);
    await esperarAssistentePronto(page);
    await expect(
      page.getByText("Aditivo à proposta “Troca de tela iPhone 12”").first(),
    ).toBeVisible();

    // Etapa 2 e 3: só o que muda em relação à proposta original
    await page
      .getByLabel("O que será feito")
      .fill("Troca da película e instalação de capa reforçada.");
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await page.getByLabel("Descrição").last().fill("Película de vidro 3D");
    await page.getByLabel("Quantidade").last().fill("1");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Valor por unidade").last().fill("8000");
    await page.getByLabel("Prazo", { exact: true }).fill("No mesmo dia");
    // Pagamento e garantia vieram da proposta original
    await expect(page.getByLabel("Garantia")).toHaveValue("90 dias para peça e serviço");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Etapa 4: o botão e o aviso falam de aditivo
    await expect(
      page.getByText("Aditivo à proposta “Troca de tela iPhone 12”").first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Enviar aditivo" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Enviar este aditivo?")).toBeVisible();
    await dialogo.getByRole("button", { name: "Enviar aditivo" }).click();
    await expect(page.getByRole("heading", { name: "Aditivo criado" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(/Segue o aditivo “Aditivo: Troca de tela iPhone 12”, no valor de R\$ 80,00/),
    ).toBeVisible();
    const caminho = await lerCaminho(page);

    // Banco: vínculo e referência SELADA dentro do documento (e portanto do hash)
    const a = await filho(pai.id, "aditivo");
    expect(a).toMatchObject({ proposta_pai_id: pai.id, status: "enviada" });
    const v = await versaoDe(a.id);
    expect(v.conteudo).toMatchObject({
      referencia: {
        proposta_id: pai.id,
        titulo: "Troca de tela iPhone 12",
        hash_documento: pai.hash,
      },
      valor_total_centavos: 8000,
    });

    // O cliente abre o link, aceita (com código por e-mail) e baixa o comprovante
    const anonimo = await browser.newContext();
    const c = await anonimo.newPage();
    await c.goto(caminho);
    await expect(c.getByText("Aditivo enviado via")).toBeVisible();
    await expect(c.getByText("Aditivo à proposta “Troca de tela iPhone 12”").first()).toBeVisible();
    await expect(c.getByRole("button", { name: "Recusar aditivo" })).toBeVisible();
    await c.getByRole("button", { name: "Aceitar aditivo" }).click();
    const folha = c.getByRole("dialog");
    await expect(folha.getByText(/aceito os termos acima/)).toBeVisible();
    await expect(folha.getByText(/Li o aditivo “Aditivo: Troca de tela iPhone 12”/)).toBeVisible();
    await folha.getByLabel("CPF", { exact: true }).fill("52998224725");
    await folha.getByRole("checkbox").check();
    const antes = (await emailsPara(clienteEmail)).length;
    const codigo = await pedirCodigo(folha, clienteEmail, antes);
    await digitarEConfirmar(folha, codigo, "Confirmar aceite");
    await expect(folha.getByRole("heading", { name: "Aceite do aditivo registrado" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(folha.getByRole("link", { name: "Baixar comprovante" })).toBeVisible();

    // E-mails com o PDF anexo, com o texto do aditivo
    const { data: aceite } = await service
      .from("aceites")
      .select("codigo_comprovante, texto_consentimento")
      .eq("versao_id", v.id)
      .single();
    expect(aceite!.texto_consentimento).toContain("o aditivo “Aditivo: Troca de tela iPhone 12”");
    await expect
      .poll(async () => (await emailsPara(clienteEmail)).find((e) => /aditivo/.test(e.subject)), {
        timeout: 30_000,
      })
      .toMatchObject({
        subject: "Comprovante do seu aceite do aditivo: Aditivo: Troca de tela iPhone 12",
        anexos: [
          { nome: `comprovante-${aceite!.codigo_comprovante}.pdf`, tipo: "application/pdf" },
        ],
      });
    await expect
      .poll(async () => (await emailsPara(conta.email))[0]?.subject, { timeout: 30_000 })
      .toBe("Aditivo aceito: Aditivo: Troca de tela iPhone 12");

    // /verificar diz que é um aditivo
    await c.goto(`/verificar?codigo=${aceite!.codigo_comprovante}`);
    await c.getByRole("button", { name: "Verificar" }).click();
    await expect(c.getByRole("heading", { name: "Documento íntegro" })).toBeVisible();
    await expect(c.getByText("Aditivo", { exact: true })).toBeVisible();
    await anonimo.close();

    // O prestador vê o aditivo ligado à proposta, e a proposta lista o aditivo
    await page.goto(`/propostas/${a.id}`);
    await expect(page.getByRole("link", { name: "“Troca de tela iPhone 12”" })).toBeVisible();
    await expect(page.getByText(/Aceito por Rafael Lima/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Baixar comprovante (PDF)" })).toBeVisible();
    await page.goto(`/propostas/${pai.id}`);
    await expect(page.getByRole("heading", { name: "Aditivos e entregas" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Aditivo: Aditivo: Troca de tela/ })).toBeVisible();
  });
});

test.describe("aceite de entrega", () => {
  test("checklist e foto, envio, confirmação do cliente com as fotos e comprovante", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "fluxo longo; o celular é coberto pelo teste de 375px mais abaixo");
    test.setTimeout(180_000);
    const conta = await prestador();
    const clienteEmail = novoEmail();
    const pai = await semearProposta(conta.id, {
      status: "aceita",
      titulo: "Troca de tela iPhone 12",
      cliente: "Rafael Lima",
      clienteEmail,
    });

    await login(page, conta);
    await page.goto(`/propostas/${pai.id}`);
    await page.getByRole("button", { name: "Registrar entrega" }).click();
    await expect(page).toHaveURL(/\/propostas\/[0-9a-f-]{36}\/editar$/);
    await expect(page.getByRole("heading", { name: "Registrar entrega" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar entrega" })).toBeEnabled({
      timeout: 30_000,
    });

    // O checklist vem dos itens da proposta, ainda sem marcar
    await expect(page.getByLabel("Descrição do item 1")).toHaveValue(
      "Tela compatível com o modelo",
    );
    await expect(page.getByLabel("Item 1 entregue")).not.toBeChecked();

    // Sem preencher: cada problema aparece no seu campo
    await page.getByRole("button", { name: "Enviar entrega" }).click();
    await expect(
      page.getByText("Descreva o que foi entregue (pelo menos 10 caracteres)."),
    ).toBeVisible();
    await expect(page.getByText("Marque como entregue ou remova o item.")).toBeVisible();

    await page
      .getByLabel("O que foi entregue")
      .fill("Tela trocada, com testes de touch, câmera e Face ID depois do reparo.");
    await page.getByLabel("Item 1 entregue").check();

    // Foto: comprimida no navegador e enviada ao bucket privado
    await page.locator('input[type="file"]').setInputFiles({
      name: "IMG 001.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(page.getByRole("img", { name: /Foto 1: IMG 001\.jpg/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("(1 de 6)")).toBeVisible();

    // Arquivo que não é imagem não entra
    await page.locator('input[type="file"]').setInputFiles({
      name: "documento.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("não sou uma foto"),
    });
    await expect(page.getByText(/documento\.txt: Este arquivo não é uma imagem/)).toBeVisible();
    await expect(page.getByText("(1 de 6)")).toBeVisible();

    // Autosave: sobrevive a recarregar, e a foto volta pela URL assinada
    await expect(
      page.getByRole("status").filter({ hasText: /Rascunho salvo às \d{2}:\d{2}/ }),
    ).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByLabel("O que foi entregue")).toHaveValue(/Tela trocada/);
    const img = page.getByRole("img", { name: /Foto 1: IMG 001\.jpg/ });
    await expect(img).toBeVisible();
    expect(await img.getAttribute("src")).toContain("/storage/v1/object/sign/entregas/");

    // Envia
    await expect(page.getByRole("button", { name: "Enviar entrega" })).toBeEnabled({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Enviar entrega" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Enviar esta entrega?")).toBeVisible();
    await dialogo.getByRole("button", { name: "Enviar entrega" }).click();
    await expect(page.getByRole("heading", { name: "Entrega criada" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(/O serviço “Entrega: Troca de tela iPhone 12” foi concluído/),
    ).toBeVisible();
    const caminho = await lerCaminho(page);

    // Banco: a foto foi selada com SHA-256 e a referência aponta para a proposta aceita
    const e = await filho(pai.id, "entrega");
    expect(e.status).toBe("enviada");
    const v = await versaoDe(e.id);
    const doc = v.conteudo as {
      fotos: { path: string; sha256: string; bytes: number; tipo: string }[];
      referencia: { hash_documento: string };
    };
    expect(doc.fotos).toHaveLength(1);
    expect(doc.fotos[0]).toMatchObject({
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      tipo: "image/jpeg",
    });
    expect(doc.fotos[0].path.startsWith(`${conta.id}/${e.id}/`)).toBe(true);
    expect(doc.referencia.hash_documento).toBe(pai.hash);

    // O cliente vê o registro com a foto, confirma o recebimento e baixa o comprovante
    const anonimo = await browser.newContext();
    const c = await anonimo.newPage();
    await c.goto(caminho);
    await expect(c.getByText("Entrega registrada via")).toBeVisible();
    await expect(c.getByRole("heading", { name: "O que foi entregue" })).toBeVisible();
    await expect(c.getByText("Tela compatível com o modelo")).toBeVisible();
    const fotoCliente = c.getByRole("img", { name: /Foto da entrega: IMG 001\.jpg/ });
    await expect(fotoCliente).toBeVisible();
    expect(await fotoCliente.getAttribute("src")).toContain("/storage/v1/object/sign/entregas/");
    await expect(c.getByText("R$")).toHaveCount(0); // entrega não tem valor
    await semRolagemHorizontal(c);

    await c.getByRole("button", { name: "Confirmar recebimento" }).click();
    const folha = c.getByRole("dialog");
    await expect(folha.getByText(/Confirmo que recebi a entrega do serviço/)).toBeVisible();
    await folha.getByLabel("CPF", { exact: true }).fill("52998224725");
    await folha.getByRole("checkbox").check();
    const antes = (await emailsPara(clienteEmail)).length;
    const codigo = await pedirCodigo(folha, clienteEmail, antes);
    await digitarEConfirmar(folha, codigo, "Confirmar recebimento");
    await expect(folha.getByRole("heading", { name: "Recebimento confirmado" })).toBeVisible({
      timeout: 20_000,
    });

    const { data: aceite } = await service
      .from("aceites")
      .select("codigo_comprovante, pdf_path, texto_consentimento")
      .eq("versao_id", v.id)
      .single();
    expect(aceite!.texto_consentimento).not.toContain("R$");

    const [download] = await Promise.all([
      c.waitForEvent("download"),
      folha.getByRole("link", { name: "Baixar comprovante" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`comprovante-${aceite!.codigo_comprovante}.pdf`);

    await expect
      .poll(async () => (await emailsPara(clienteEmail)).find((x) => /entrega/.test(x.subject)), {
        timeout: 30_000,
      })
      .toMatchObject({
        subject: "Comprovante da confirmação de entrega: Entrega: Troca de tela iPhone 12",
        anexos: [
          { nome: `comprovante-${aceite!.codigo_comprovante}.pdf`, tipo: "application/pdf" },
        ],
      });
    await anonimo.close();

    // O prestador vê a entrega confirmada, com a foto, e não consegue criar outro aditivo a partir dela
    await page.goto(`/propostas/${e.id}`);
    await expect(page.getByText("Aceita", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Confirmada por Rafael Lima/)).toBeVisible();
    await expect(page.getByRole("img", { name: /Foto da entrega: IMG 001\.jpg/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo aditivo" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Baixar comprovante (PDF)" })).toBeVisible();
  });

  /** Rascunho de entrega criado direto no banco, com a foto indicada, e o editor aberto nele. */
  async function abrirEntregaComFoto(
    page: Page,
    conta: { id: string; email: string; password: string },
    foto: (entregaId: string) => Promise<string>,
  ) {
    const pai = await semearProposta(conta.id, { status: "aceita" });
    const { data: e } = await service
      .from("propostas")
      .insert({
        prestador_id: conta.id,
        tipo: "entrega",
        proposta_pai_id: pai.id,
        cliente_nome: "Rafael Lima",
        cliente_email: "rafael@example.com",
        titulo: "Entrega: teste",
      })
      .select("id")
      .single();
    await service.from("proposta_versoes").insert({
      proposta_id: e!.id,
      numero: 1,
      conteudo: {
        resumo: "Entrega concluída com sucesso, conforme combinado.",
        checklist: [{ texto: "Tela trocada", feito: true }],
        fotos: [{ path: await foto(e!.id), nome: "foto.png" }],
        validade_dias: 15,
      },
    });
    await login(page, conta);
    await page.goto(`/propostas/${e!.id}/editar`);
    await expect(page.getByRole("button", { name: "Enviar entrega" })).toBeEnabled({
      timeout: 30_000,
    });
    return e!.id;
  }

  const statusDe = async (id: string) =>
    (await service.from("propostas").select("status").eq("id", id).single()).data?.status;

  test("foto de outro prestador: não aparece, não salva e não envia", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "regra de servidor, igual no celular");
    test.setTimeout(120_000);
    const conta = await prestador();
    const alheio = await criarConta({ nome: "Outro Prestador" });
    const id = await abrirEntregaComFoto(page, conta, async (entregaId) => {
      const roubada = `${alheio.id}/${entregaId}/${randomUUID()}.png`;
      await service.storage.from("entregas").upload(roubada, PNG, { contentType: "image/png" });
      return roubada;
    });

    // O servidor não assina caminho de outra pasta: a miniatura não carrega
    await expect(page.getByRole("img", { name: /Foto 1/ })).toHaveCount(0);

    // Enviar: o salvamento recusa o caminho (primeira barreira) e nada é enviado
    await page.getByRole("button", { name: "Enviar entrega" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Enviar entrega" }).click();
    await expect(
      page.getByText("Uma das fotos é inválida. Remova e anexe de novo.").first(),
    ).toBeVisible({
      timeout: 20_000,
    });
    expect(await statusDe(id)).toBe("rascunho");
  });

  test("foto que não existe no bucket: o envio confere o arquivo e recusa", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "regra de servidor, igual no celular");
    test.setTimeout(120_000);
    const conta = await prestador();
    const id = await abrirEntregaComFoto(
      page,
      conta,
      async (entregaId) => `${conta.id}/${entregaId}/${randomUUID()}.png`, // caminho válido, arquivo ausente
    );

    await page.getByRole("button", { name: "Enviar entrega" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Enviar entrega" }).click();
    await expect(page.getByText("Não encontramos esta foto. Remova e anexe de novo.")).toBeVisible({
      timeout: 20_000,
    });
    expect(await statusDe(id)).toBe("rascunho");
  });
});

test("editor de entrega e página do cliente cabem em 375px (sem rolagem horizontal)", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const conta = await prestador();
  const pai = await semearProposta(conta.id, { status: "aceita" });
  const { data: e } = await service
    .from("propostas")
    .insert({
      prestador_id: conta.id,
      tipo: "entrega",
      proposta_pai_id: pai.id,
      cliente_nome: "Rafael Lima",
      cliente_email: "rafael@example.com",
      titulo: "Entrega: Troca de tela iPhone 12",
    })
    .select("id")
    .single();
  await service.from("proposta_versoes").insert({
    proposta_id: e!.id,
    numero: 1,
    conteudo: {
      resumo: "Tela trocada, com testes de touch, câmera e Face ID depois do reparo.",
      checklist: [{ texto: "Tela compatível com o modelo, instalada e testada", feito: true }],
      fotos: [],
      validade_dias: 15,
    },
  });

  await login(page, conta);
  await page.goto(`/propostas/${e!.id}/editar`);
  await expect(page.getByRole("button", { name: "Enviar entrega" })).toBeEnabled({
    timeout: 30_000,
  });
  await semRolagemHorizontal(page);

  // Detalhe da proposta aceita (com os botões de aditivo e entrega)
  await page.goto(`/propostas/${pai.id}`);
  await expect(page.getByRole("button", { name: "Novo aditivo" })).toBeVisible();
  await semRolagemHorizontal(page);

  // Página do cliente (proposta enviada; a entrega usa o mesmo contêiner e uma grade de 2 colunas)
  const enviada = await semearProposta(conta.id, { status: "enviada" });
  const anonimo = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const c = await anonimo.newPage();
  await c.goto(`/p/${enviada.token}`);
  await expect(c.getByRole("button", { name: "Aceitar proposta" })).toBeVisible();
  await semRolagemHorizontal(c);
  await anonimo.close();
});
