import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import {
  criarConta,
  digitarEConfirmar,
  outroCodigo,
  pedirCodigo,
  emailsPara,
  entrar,
  novoEmail,
  semRolagemHorizontal,
  semearProposta,
  service,
  zerarLimitesDeTaxa,
} from "./support";

/*
 * Página pública do cliente (/p/[token]): o fluxo principal do produto. O cliente NÃO tem conta:
 * estes testes usam um navegador sem login, como o celular de quem recebe o link no WhatsApp.
 */

// O servidor local vê o mesmo IP em todas as requisições: os contadores do limite de taxa são
// zerados antes de cada teste (em produção eles valem por IP real, definido pela Vercel).
test.beforeEach(async () => {
  await zerarLimitesDeTaxa();
});

async function prestadorComEmpresa() {
  const conta = await criarConta({ nome: "Carlos Andrade" });
  await service
    .from("profiles")
    .update({ empresa_nome: "Andrade Reformas", telefone: "11912345678" })
    .eq("id", conta.id);
  return conta;
}

async function statusDe(id: string) {
  const { data } = await service.from("propostas").select("status").eq("id", id).single();
  return data?.status;
}

async function tiposDeEvento(id: string) {
  const { data } = await service
    .from("auditoria_eventos")
    .select("tipo")
    .eq("proposta_id", id)
    .order("criado_em");
  return (data ?? []).map((e) => e.tipo);
}

test.describe("o cliente responde pelo link", () => {
  test("abre, lê, erra o código uma vez e aceita; o prestador vê o aceite", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.setTimeout(150_000);
    const conta = await prestadorComEmpresa();
    const clienteEmail = novoEmail();
    const s = await semearProposta(conta.id, {
      status: "enviada",
      titulo: "Troca de tela iPhone 12",
      cliente: "Rafael Lima",
      clienteEmail,
    });

    await page.goto(`/p/${s.token}`);

    // O documento como o prestador o enviou
    await expect(page.getByText("Andrade Reformas").first()).toBeVisible();
    await expect(page.getByText("Proposta enviada via")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Troca de tela iPhone 12" })).toBeVisible();
    await expect(page.getByText("R$ 970,00").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Não está incluso" })).toBeVisible();
    await expect(page.getByText(s.hash!)).toBeVisible();

    // "Tenho dúvidas" abre o WhatsApp do prestador, já com a mensagem
    const duvidas = page.getByRole("link", { name: "Tenho dúvidas" });
    const href = (await duvidas.getAttribute("href"))!;
    expect(href.startsWith("https://wa.me/5511912345678?text=")).toBe(true);
    expect(decodeURIComponent(href)).toContain("Troca de tela iPhone 12");

    // Abrir no navegador marca como visualizada (o navegador avisa depois que a página carrega)
    await expect.poll(() => statusDe(s.id), { timeout: 15_000 }).toBe("visualizada");
    await semRolagemHorizontal(page);

    // Aceitar: nome já preenchido, CPF, consentimento, código por e-mail
    await page.getByRole("button", { name: "Aceitar proposta" }).click();
    const folha = page.getByRole("dialog");
    await expect(folha.getByRole("heading", { name: "Confirmar aceite" })).toBeVisible();
    await expect(folha.getByLabel("Seu nome completo")).toHaveValue("Rafael Lima");
    await expect(folha.getByText(/no valor de R\$ 970,00, e aceito os termos acima/)).toBeVisible();
    await folha.getByLabel("CPF", { exact: true }).fill("52998224725");
    await expect(folha.getByLabel("CPF", { exact: true })).toHaveValue("529.982.247-25");
    await folha.getByRole("checkbox").check();
    const codigo = await pedirCodigo(folha, clienteEmail);
    await expect(folha.getByText(`${clienteEmail[0]}***@example.com`).first()).toBeVisible();

    await digitarEConfirmar(folha, outroCodigo(codigo), "Confirmar aceite");
    await expect(folha.getByText("Código incorreto. Você ainda tem 4 tentativas.")).toBeVisible();

    await digitarEConfirmar(folha, codigo, "Confirmar aceite");
    await expect(folha.getByRole("heading", { name: "Aceite registrado" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(folha.getByText(/Guarde o comprovante: enviamos uma cópia em PDF/)).toBeVisible();

    // Banco: aceite com o hash do documento, CPF só dígitos, consentimento gravado; trilha completa
    const { data: aceite } = await service
      .from("aceites")
      .select("*")
      .eq("versao_id", s.versaoId)
      .single();
    expect(aceite).toMatchObject({
      resultado: "aceito",
      cliente_nome: "Rafael Lima",
      cliente_cpf: "52998224725",
      hash_documento: s.hash,
      pdf_path: `${conta.id}/${aceite!.id}.pdf`,
    });
    expect(aceite!.texto_consentimento).toContain("Troca de tela iPhone 12");
    expect(aceite!.texto_consentimento).toContain("Andrade Reformas");
    expect(aceite!.user_agent).toBeTruthy();
    await expect(folha.getByText(aceite!.codigo_comprovante).first()).toBeVisible();
    expect(await statusDe(s.id)).toBe("aceita");
    expect((await tiposDeEvento(s.id)).slice(0, 5)).toEqual([
      "aberta",
      "otp_enviado",
      "otp_falhou",
      "otp_verificado",
      "aceita",
    ]);

    // Comprovante: baixado na hora pela tela de sucesso (gera se ainda não estiver pronto)
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      folha.getByRole("link", { name: "Baixar comprovante" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`comprovante-${aceite!.codigo_comprovante}.pdf`);
    const pdf = readFileSync((await download.path())!);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

    // ...e por e-mail aos dois, com o PDF anexo (em segundo plano, depois da resposta)
    const anexo = {
      nome: `comprovante-${aceite!.codigo_comprovante}.pdf`,
      tipo: "application/pdf",
    };
    await expect
      .poll(
        async () => (await emailsPara(clienteEmail)).find((e) => /Comprovante/.test(e.subject)),
        {
          timeout: 30_000,
        },
      )
      .toMatchObject({
        subject: "Comprovante do seu aceite: Troca de tela iPhone 12",
        anexos: [anexo],
      });
    await expect
      .poll(async () => (await emailsPara(conta.email))[0], { timeout: 30_000 })
      .toMatchObject({ subject: "Proposta aceita: Troca de tela iPhone 12", anexos: [anexo] });
    await expect
      .poll(async () => (await tiposDeEvento(s.id)).slice(5).sort(), { timeout: 30_000 })
      .toEqual(["email_enviado", "pdf_gerado"]);

    // O arquivo guardado é um só: o do e-mail, o do download e o do bucket são o mesmo
    const { data: guardado } = await service.storage
      .from("comprovantes")
      .download(aceite!.pdf_path!);
    expect(Buffer.from(await guardado!.arrayBuffer()).equals(pdf)).toBe(true);

    // Fechou: a página agora mostra a proposta aceita, sem botões de resposta
    await folha.getByRole("button", { name: "Voltar para a proposta" }).click();
    await expect(page.getByRole("button", { name: "Aceitar proposta" })).toHaveCount(0);
    await expect(
      page.getByText("Aceita por Rafael Lima (CPF ***.982.247-**).", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("52998224725")).toHaveCount(0);
    await semRolagemHorizontal(page);

    // O prestador vê o aceite e a trilha
    if (!isMobile) {
      const contexto = await browser.newContext();
      const prestador = await contexto.newPage();
      await entrar(prestador, conta.email, conta.password);
      await expect(prestador).toHaveURL(/\/inicio/);
      await prestador.goto(`/propostas/${s.id}`);
      await expect(prestador.getByText("Aceita", { exact: true }).first()).toBeVisible();
      await expect(prestador.getByText("Proposta aceita").first()).toBeVisible();
      await expect(prestador.getByText("Código incorreto")).toBeVisible();
      await contexto.close();
    }
  });

  test("pedir ajuste exige comentário; recusar não pede CPF", async ({ page, isMobile }) => {
    test.skip(isMobile, "mesmo fluxo da folha, já coberto no celular pelo aceite");
    test.setTimeout(180_000);
    const conta = await prestadorComEmpresa();

    // Ajuste
    const emailA = novoEmail();
    const ajuste = await semearProposta(conta.id, { status: "enviada", clienteEmail: emailA });
    await page.goto(`/p/${ajuste.token}`);
    await page.getByRole("button", { name: "Pedir ajuste" }).click();
    const folha = page.getByRole("dialog");
    await expect(folha.getByRole("heading", { name: "Pedir ajuste" })).toBeVisible();
    await expect(folha.getByLabel("CPF", { exact: true })).toHaveCount(0);
    await folha.getByRole("button", { name: "Enviar código" }).click();
    await expect(folha.getByText("Conte o que você gostaria de mudar.")).toBeVisible();
    await expect(folha.getByText("Marque a caixa para confirmar.")).toBeVisible();
    await folha
      .getByLabel("O que você gostaria de mudar?")
      .fill("Pode incluir a película de vidro?");
    await folha.getByRole("checkbox").check();
    const c1 = await pedirCodigo(folha, emailA);
    await digitarEConfirmar(folha, c1, "Enviar pedido de ajuste");
    await expect(folha.getByRole("heading", { name: "Pedido de ajuste registrado" })).toBeVisible({
      timeout: 20_000,
    });
    expect(await statusDe(ajuste.id)).toBe("ajuste_solicitado");
    await folha.getByRole("button", { name: "Voltar para a proposta" }).click();
    await expect(
      page.getByText(/Você pediu ajuste em .*: “Pode incluir a película de vidro\?”/),
    ).toBeVisible();

    // Recusa
    const emailR = novoEmail();
    const recusa = await semearProposta(conta.id, { status: "enviada", clienteEmail: emailR });
    await page.goto(`/p/${recusa.token}`);
    await page.getByRole("button", { name: "Recusar proposta" }).click();
    await expect(folha.getByRole("heading", { name: "Recusar proposta" })).toBeVisible();
    await expect(folha.getByLabel(/Quer contar o motivo\?/)).toBeVisible();
    await folha.getByRole("checkbox").check();
    const c2 = await pedirCodigo(folha, emailR);
    await digitarEConfirmar(folha, c2, "Confirmar recusa");
    await expect(folha.getByRole("heading", { name: "Recusa registrada" })).toBeVisible({
      timeout: 20_000,
    });
    expect(await statusDe(recusa.id)).toBe("recusada");
    const { data: aceite } = await service
      .from("aceites")
      .select("cliente_cpf, pdf_path")
      .eq("versao_id", recusa.versaoId)
      .single();
    expect(aceite).toEqual({ cliente_cpf: null, pdf_path: null });
  });

  test("código: 5 erros bloqueiam; novo código funciona; mais de 3 por hora é recusado", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "regra de servidor, igual no celular");
    test.setTimeout(180_000);
    const conta = await prestadorComEmpresa();
    const email = novoEmail();
    const s = await semearProposta(conta.id, { status: "enviada", clienteEmail: email });

    await page.goto(`/p/${s.token}`);
    await page.getByRole("button", { name: "Aceitar proposta" }).click();
    const folha = page.getByRole("dialog");
    await folha.getByLabel("CPF", { exact: true }).fill("52998224725");
    await folha.getByRole("checkbox").check();
    const primeiro = await pedirCodigo(folha, email, 0);

    for (let i = 4; i >= 1; i--) {
      await digitarEConfirmar(folha, outroCodigo(primeiro), "Confirmar aceite");
      await expect(
        folha.getByText(
          `Código incorreto. Você ainda tem ${i} ${i === 1 ? "tentativa" : "tentativas"}.`,
        ),
      ).toBeVisible();
    }
    await digitarEConfirmar(folha, outroCodigo(primeiro), "Confirmar aceite");
    await expect(folha.getByText("Código incorreto. Peça um novo código.")).toBeVisible();
    // Nem o código certo vale mais
    await digitarEConfirmar(folha, primeiro, "Confirmar aceite");
    await expect(folha.getByText("Muitas tentativas com este código. Peça um novo.")).toBeVisible();
    expect(await statusDe(s.id)).toBe("visualizada");

    // Um novo código funciona (o botão "Reenviar" espera 60 s; corrigir os dados pede outro na hora)
    await folha.getByRole("button", { name: "Corrigir meus dados" }).click();
    await pedirCodigo(folha, email, 1);
    await folha.getByRole("button", { name: "Corrigir meus dados" }).click();
    const terceiro = await pedirCodigo(folha, email, 2);
    expect(terceiro).toMatch(/^\d{6}$/);

    // Quarto pedido na mesma hora: recusado
    await folha.getByRole("button", { name: "Corrigir meus dados" }).click();
    await folha.getByRole("button", { name: "Enviar código" }).click();
    await expect(
      folha.getByText("Você já pediu 3 códigos na última hora.", { exact: false }),
    ).toBeVisible();

    const { data: codigos } = await service
      .from("otp_codigos")
      .select("id")
      .eq("proposta_id", s.id);
    expect(codigos).toHaveLength(3);
  });
});

test.describe("estados do link", () => {
  async function verInvalido(page: Page, caminho: string) {
    const resposta = await page.goto(caminho);
    expect(resposta?.status(), caminho).toBe(404);
    await expect(page.getByRole("heading", { name: "Link inválido" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ir para o início|minhas propostas/ })).toHaveCount(
      0,
    );
  }

  test("inválido, inexistente e substituído dão a mesma resposta", async ({ page, isMobile }) => {
    test.skip(isMobile, "regra de servidor, igual no celular");
    const conta = await prestadorComEmpresa();
    const s = await semearProposta(conta.id, { status: "enviada" });

    await verInvalido(page, "/p/abc");
    await verInvalido(page, `/p/${"A".repeat(43)}`);
    await verInvalido(page, "/p/..%2F..%2Fetc%2Fpasswd");

    // O prestador gerou um link novo: o antigo deixa de valer
    const { error } = await service
      .from("propostas")
      .update({ token_hash: randomBytes(32).toString("hex") })
      .eq("id", s.id);
    expect(error).toBeNull();
    await verInvalido(page, `/p/${s.token}`);
  });

  test("vencida, já aceita, com ajuste pedido e em atualização", async ({ page, isMobile }) => {
    test.skip(isMobile, "regra de servidor, igual no celular");
    test.setTimeout(120_000);
    const conta = await prestadorComEmpresa();

    const vencida = await semearProposta(conta.id, { status: "enviada" });
    await service
      .from("propostas")
      .update({ validade_em: new Date(Date.now() - 864e5).toISOString() })
      .eq("id", vencida.id);
    await page.goto(`/p/${vencida.token}`);
    await expect(
      page.getByText(/Esta proposta venceu em .* e não pode mais ser aceita/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Aceitar proposta" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Falar com Andrade Reformas" })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await tiposDeEvento(vencida.id)).toEqual([]); // vencida não registra abertura

    const aceita = await semearProposta(conta.id, { status: "aceita", cliente: "Mariana Costa" });
    await page.goto(`/p/${aceita.token}`);
    await expect(
      page.getByText(/Aceita por Mariana Costa \(CPF \*\*\*\.982\.247-\*\*\)/),
    ).toBeVisible();
    await expect(page.getByText("Aceite registrado").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Aceitar proposta" })).toHaveCount(0);

    const ajuste = await semearProposta(conta.id, { status: "ajuste_solicitado" });
    await page.goto(`/p/${ajuste.token}`);
    await expect(
      page.getByText(/Você pediu ajuste em .*: “Pode incluir a película\?”/),
    ).toBeVisible();

    // O prestador começou uma nova versão: a antiga não é mostrada nem pode ser aceita (D50)
    const atualizando = await semearProposta(conta.id, {
      status: "enviada",
      titulo: "Instalação de split",
    });
    await service
      .from("proposta_versoes")
      .insert({ proposta_id: atualizando.id, numero: 2, conteudo: {} });
    await page.goto(`/p/${atualizando.token}`);
    await expect(
      page.getByRole("heading", { name: "Esta proposta está sendo atualizada" }),
    ).toBeVisible();
    await expect(page.getByText("Não está incluso")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Aceitar proposta" })).toHaveCount(0);
  });
});

test.describe("segurança da página do cliente", () => {
  test("cabeçalhos: sem referrer, sem cache, sem indexação, sem iframe", async ({
    request,
    isMobile,
  }) => {
    test.skip(isMobile, "cabeçalhos HTTP não dependem do dispositivo");
    const conta = await prestadorComEmpresa();
    const s = await semearProposta(conta.id, { status: "enviada" });
    const r = await request.get(`/p/${s.token}`);
    expect(r.status()).toBe(200);
    const h = r.headers();
    expect(h["referrer-policy"]).toBe("no-referrer"); // o token da URL não vaza ao tocar em "Tenho dúvidas"
    expect(h["cache-control"]).toContain("no-store");
    expect(h["x-robots-tag"]).toContain("noindex");
    expect(h["x-frame-options"]).toBe("DENY");
  });

  test("o HTML não expõe e-mail completo do cliente, ids internos nem o hash do link", async ({
    request,
    isMobile,
  }) => {
    test.skip(isMobile, "conteúdo do HTML não depende do dispositivo");
    const conta = await prestadorComEmpresa();
    const email = novoEmail();
    const s = await semearProposta(conta.id, { status: "enviada", clienteEmail: email });
    const html = await (await request.get(`/p/${s.token}`)).text();
    expect(html).not.toContain(email);
    expect(html).toContain(`${email[0]}***@example.com`);
    expect(html).not.toContain(s.id); // id da proposta
    expect(html).not.toContain(conta.id); // id do prestador
    const { data } = await service.from("propostas").select("token_hash").eq("id", s.id).single();
    expect(html).not.toContain(data!.token_hash!);
  });

  test("robô de prévia de link (sem JavaScript) não marca a proposta como visualizada", async ({
    request,
    isMobile,
  }) => {
    test.skip(isMobile, "regra de servidor");
    const conta = await prestadorComEmpresa();
    const s = await semearProposta(conta.id, { status: "enviada" });
    const r = await request.get(`/p/${s.token}`, {
      headers: { "user-agent": "WhatsApp/2.24.1.0 A" },
    });
    expect(r.status()).toBe(200);
    await new Promise((ok) => setTimeout(ok, 1500));
    expect(await statusDe(s.id)).toBe("enviada");
    expect(await tiposDeEvento(s.id)).toEqual([]);
  });
});
