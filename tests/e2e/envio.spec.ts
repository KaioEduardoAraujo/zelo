import { expect, test, type Page } from "@playwright/test";

import { hashDocumento } from "@/lib/crypto/hash";

import { criarConta, entrar, semRolagemHorizontal, semearProposta, service } from "./support";

async function login(page: Page, conta: { email: string; password: string }) {
  await entrar(page, conta.email, conta.password);
  await expect(page).toHaveURL(/\/inicio/);
}

const salvo = (page: Page) =>
  page.getByRole("status").filter({ hasText: /Rascunho salvo às \d{2}:\d{2}/ });

/** Confirma o envio no diálogo e espera a tela "Proposta criada". */
async function enviarPelaEtapa4(page: Page) {
  await page.getByRole("button", { name: "Enviar proposta" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByText("Enviar esta proposta?")).toBeVisible();
  await dialogo.getByRole("button", { name: "Enviar proposta" }).click();
  await expect(page.getByRole("heading", { name: "Proposta criada" })).toBeVisible({
    timeout: 30_000,
  });
}

/** O link da proposta aparece na mensagem que será enviada. Devolve o link e o token. */
async function lerLink(page: Page) {
  const mensagem = await page
    .getByText(/\/p\/[A-Za-z0-9_-]{43}/)
    .first()
    .innerText();
  const link = mensagem.match(/https?:\/\/\S+\/p\/([A-Za-z0-9_-]{43})/);
  expect(link, "link na mensagem").not.toBeNull();
  return { link: link![0], token: link![1] };
}

test.describe("enviar a proposta", () => {
  test("confirma, trava a versão e mostra 'Proposta criada' com WhatsApp e copiar link", async ({
    page,
    context,
    isMobile,
  }) => {
    test.setTimeout(150_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const conta = await criarConta({ nome: "Carlos Andrade" });
    const { id } = await semearProposta(conta.id, {
      titulo: "Troca de tela iPhone 12",
      cliente: "Rafael Lima",
    });
    await service.from("propostas").update({ cliente_telefone: "11987654321" }).eq("id", id);
    await login(page, conta);

    await page.goto(`/propostas/${id}/editar?etapa=4`);
    await expect(page.getByRole("heading", { name: "Revisar", level: 2 })).toBeVisible();
    await expect(page.getByText("Falta preencher")).toHaveCount(0);
    await enviarPelaEtapa4(page);

    // Tela "Proposta criada": mensagem pronta, WhatsApp e copiar link
    await expect(page.getByText("Mensagem que será enviada")).toBeVisible();
    await expect(page.getByText("Olá, Rafael! Aqui é Carlos Andrade.")).toBeVisible();
    const { link, token } = await lerLink(page);
    expect(token).toHaveLength(43);

    const whatsapp = page.getByRole("link", { name: /Enviar por WhatsApp/ });
    const href = (await whatsapp.getAttribute("href"))!;
    expect(href.startsWith("https://wa.me/5511987654321?text=")).toBe(true);
    expect(decodeURIComponent(href.split("?text=")[1])).toContain(link);
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    await expect(whatsapp).toHaveAttribute("rel", /noopener/);

    await page.getByRole("button", { name: "Copiar link" }).click();
    await expect(page.getByText("Link copiado.")).toBeVisible();
    if (!isMobile) {
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
    }
    await expect(page.getByText("Este link só aparece agora.")).toBeVisible();
    await semRolagemHorizontal(page);

    // Banco: versão travada com hash, link guardado SÓ como hash, evento na trilha
    const svc = service;
    const { data: p } = await svc.from("propostas").select("*").eq("id", id).single();
    expect(p).toMatchObject({ status: "enviada" });
    expect(p!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(p)).not.toContain(token); // o token em si não está em nenhuma coluna
    const dias = (new Date(p!.validade_em!).getTime() - Date.now()) / 864e5;
    expect(dias).toBeGreaterThan(6.9);
    expect(dias).toBeLessThan(7.1);

    const { data: v } = await svc
      .from("proposta_versoes")
      .select("*")
      .eq("proposta_id", id)
      .single();
    expect(v!.enviada_em).not.toBeNull();
    expect(v!.hash_sha256).toBe(hashDocumento(v!.conteudo)); // recalculado a partir do que está guardado
    expect(JSON.stringify(v)).not.toContain(token);
    expect(v!.conteudo).toMatchObject({
      proposta_id: id,
      versao: 1,
      titulo: "Troca de tela iPhone 12",
      prestador: { nome: "Carlos Andrade" },
      cliente: { nome: "Rafael Lima", telefone: "11987654321" },
    });

    const { data: eventos } = await svc
      .from("auditoria_eventos")
      .select("tipo, metadados")
      .eq("proposta_id", id);
    expect(eventos).toEqual([
      { tipo: "enviada", metadados: { versao: 1, hash_sha256: v!.hash_sha256 } },
    ]);

    // Detalhe: enviada, hash conferido, na trilha, e o assistente não abre mais
    await page.getByRole("link", { name: "Ver proposta" }).click();
    await expect(page).toHaveURL(new RegExp(`/propostas/${id}$`));
    await expect(page.getByText("Enviada", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(v!.hash_sha256!)).toBeVisible();
    await expect(page.getByText(/Conteúdo conferido/)).toBeVisible();
    await expect(page.getByText("Proposta enviada").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar novo link" })).toBeVisible();
    await page.goto(`/propostas/${id}/editar`);
    await expect(page).toHaveURL(new RegExp(`/propostas/${id}$`));
  });

  test("rascunho incompleto não envia e aponta o que falta", async ({ page }) => {
    test.setTimeout(120_000);
    const conta = await criarConta();
    const { id, versaoId } = await semearProposta(conta.id);
    const { data: v } = await service
      .from("proposta_versoes")
      .select("conteudo")
      .eq("id", versaoId)
      .single();
    await service
      .from("proposta_versoes")
      .update({ conteudo: { ...(v!.conteudo as object), prazo: "" } })
      .eq("id", versaoId);
    await login(page, conta);

    await page.goto(`/propostas/${id}/editar?etapa=4`);
    await expect(page.getByText("Falta preencher")).toBeVisible();
    await expect(page.getByText("Informe o prazo.")).toBeVisible();
    await page.getByRole("button", { name: "Enviar proposta" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0); // nem chega a pedir confirmação

    const { data: p } = await service
      .from("propostas")
      .select("status, token_hash")
      .eq("id", id)
      .single();
    expect(p).toEqual({ status: "rascunho", token_hash: null });

    // "Corrigir" leva à etapa certa; corrigindo, dá para enviar
    await page.getByRole("button", { name: "Corrigir" }).click();
    await expect(page.getByLabel("Prazo", { exact: true })).toBeVisible();
    await page.getByLabel("Prazo", { exact: true }).fill("2 dias úteis");
    await expect(salvo(page)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Falta preencher")).toHaveCount(0);
    await enviarPelaEtapa4(page);
  });

  test("cancelar na confirmação não envia nada", async ({ page, isMobile }) => {
    test.skip(isMobile, "regra igual no celular");
    const conta = await criarConta();
    const { id } = await semearProposta(conta.id);
    await login(page, conta);

    await page.goto(`/propostas/${id}/editar?etapa=4`);
    await page.getByRole("button", { name: "Enviar proposta" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText(/não pode mais ser editada/)).toBeVisible();
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogo).toBeHidden();

    const { data } = await service.from("propostas").select("status").eq("id", id).single();
    expect(data?.status).toBe("rascunho");
  });
});

test.describe("novo link", () => {
  test("gera outro link, o anterior deixa de existir e o link some da tela ao fechar", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "fluxo igual no celular; a tela de envio já é coberta nos dois tamanhos");
    test.setTimeout(120_000);
    const conta = await criarConta({ nome: "Carlos Andrade" });
    const { id } = await semearProposta(conta.id, { status: "enviada", cliente: "Rafael Lima" });
    const antes = await service.from("propostas").select("token_hash").eq("id", id).single();
    await login(page, conta);

    await page.goto(`/propostas/${id}`);
    await page.getByRole("button", { name: "Gerar novo link" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Gerar um novo link?")).toBeVisible();
    await expect(dialogo.getByText(/deixa de funcionar na hora/)).toBeVisible();

    // Cancelar não muda nada
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    const intacto = await service.from("propostas").select("token_hash").eq("id", id).single();
    expect(intacto.data?.token_hash).toBe(antes.data?.token_hash);

    await page.getByRole("button", { name: "Gerar novo link" }).click();
    await dialogo.getByRole("button", { name: "Gerar novo link" }).click();
    await expect(dialogo.getByText("Novo link gerado")).toBeVisible({ timeout: 30_000 });
    const { token } = await lerLink(page);
    await expect(dialogo.getByRole("link", { name: /Enviar por WhatsApp/ })).toBeVisible();

    const { data: depois } = await service.from("propostas").select("*").eq("id", id).single();
    expect(depois!.token_hash).not.toBe(antes.data?.token_hash);
    expect(JSON.stringify(depois)).not.toContain(token);
    const { data: achado } = await service
      .from("propostas")
      .select("id")
      .eq("token_hash", antes.data!.token_hash!);
    expect(achado).toEqual([]);

    // Fechou, o link some da memória: abrir de novo pede a confirmação outra vez
    await dialogo.getByRole("button", { name: "Fechar" }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByText(token)).toHaveCount(0);
    await page.getByRole("button", { name: "Gerar novo link" }).click();
    await expect(page.getByRole("dialog").getByText("Gerar um novo link?")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

    await page.reload();
    await expect(page.getByText("Novo link gerado").first()).toBeVisible(); // na trilha de auditoria
  });

  test("o diálogo do novo link cabe na tela, no celular e no desktop", async ({ page }) => {
    test.setTimeout(120_000);
    const conta = await criarConta();
    const { id } = await semearProposta(conta.id, { status: "enviada" });
    await login(page, conta);

    await page.goto(`/propostas/${id}`);
    await page.getByRole("button", { name: "Gerar novo link" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Gerar novo link" }).click();
    await expect(dialogo.getByText("Novo link gerado", { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // O conteúdo não pode ser mais largo que o diálogo (a linha do link é longa e não quebra sozinha)
    const { rolagem, visivel } = await dialogo.evaluate((el) => ({
      rolagem: el.scrollWidth - el.clientWidth,
      visivel: el.getBoundingClientRect().right <= window.innerWidth,
    }));
    expect(rolagem).toBeLessThanOrEqual(1);
    expect(visivel).toBe(true);
    await expect(dialogo.getByRole("link", { name: /Enviar por WhatsApp/ })).toBeInViewport();
    await semRolagemHorizontal(page);
  });

  test("proposta vencida não gera link: pede uma nova versão", async ({ page, isMobile }) => {
    test.skip(isMobile, "regra igual no celular");
    const conta = await criarConta();
    const { id } = await semearProposta(conta.id, { status: "enviada" });
    await service
      .from("propostas")
      .update({ validade_em: new Date(Date.now() - 864e5).toISOString() })
      .eq("id", id);
    await login(page, conta);

    await page.goto(`/propostas/${id}`);
    await expect(page.getByText("Expirada", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar novo link" })).toHaveCount(0);
    await expect(page.getByText(/Esta proposta venceu/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Criar nova versão/ })).toBeVisible();
  });
});

test.describe("reenviar uma nova versão", () => {
  test("a versão 2 troca o link; a versão 1 continua intacta e conferida", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "regra de servidor; o fluxo de envio é coberto nos dois tamanhos");
    test.setTimeout(180_000);
    const conta = await criarConta();
    const enviada = await semearProposta(conta.id, { status: "enviada" });
    const antes = await service
      .from("propostas")
      .select("token_hash")
      .eq("id", enviada.id)
      .single();
    await login(page, conta);

    await page.goto(`/propostas/${enviada.id}`);
    await page.getByRole("button", { name: "Criar nova versão para editar" }).click();
    await expect(page).toHaveURL(/editar\?etapa=2$/);
    await page
      .getByLabel("O que será feito")
      .fill("Escopo da versão 2, depois do pedido de ajuste do cliente.");
    await expect(salvo(page)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.getByRole("heading", { name: "Valores, prazo e pagamento", level: 2 }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Revisar", level: 2 })).toBeVisible();
    await enviarPelaEtapa4(page);

    const svc = service;
    const { data: p } = await svc
      .from("propostas")
      .select("token_hash, versao_atual, status")
      .eq("id", enviada.id)
      .single();
    expect(p).toMatchObject({ versao_atual: 2, status: "enviada" });
    expect(p!.token_hash).not.toBe(antes.data?.token_hash); // o link da versão 1 morreu

    const { data: versoes } = await svc
      .from("proposta_versoes")
      .select("numero, hash_sha256, conteudo")
      .eq("proposta_id", enviada.id)
      .order("numero");
    expect(versoes).toHaveLength(2);
    expect(versoes![0].hash_sha256).toBe(enviada.hash); // versão 1 intacta
    expect(versoes![1].hash_sha256).toBe(hashDocumento(versoes![1].conteudo));
    expect(versoes![1].hash_sha256).not.toBe(versoes![0].hash_sha256);
    expect(versoes![1].conteudo).toMatchObject({ proposta_id: enviada.id, versao: 2 });

    await page.getByRole("link", { name: "Ver proposta" }).click();
    await expect(page.getByRole("link", { name: "Versão 1", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Versão 2", exact: true })).toBeVisible();
    await expect(
      page.getByText("Escopo da versão 2, depois do pedido de ajuste do cliente.").first(),
    ).toBeVisible();
    await expect(page.getByText(/Conteúdo conferido/)).toBeVisible();

    // A versão 1 também confere, com o mesmo hash de sempre
    await page.getByRole("link", { name: "Versão 1", exact: true }).click();
    await expect(page.getByText(enviada.hash!)).toBeVisible();
    await expect(page.getByText(/Conteúdo conferido/)).toBeVisible();
    await expect(page.getByText("O conteúdo guardado não bate")).toHaveCount(0);
  });
});
