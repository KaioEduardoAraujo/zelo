import { expect, test, type Page } from "@playwright/test";

import { criarConta, entrar, semRolagemHorizontal, semearProposta, service } from "./support";

/** Entra e espera o painel abrir (o redirecionamento do login é assíncrono). */
async function login(page: Page, conta: { email: string; password: string }) {
  await entrar(page, conta.email, conta.password);
  await expect(page).toHaveURL(/\/inicio/);
}

const salvo = (page: Page) =>
  page.getByRole("status").filter({ hasText: /Rascunho salvo às \d{2}:\d{2}/ });

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

test.describe("assistente de proposta", () => {
  test("modelo → 4 etapas → rascunho salvo, com o total recalculado pelo servidor", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const conta = await criarConta({ nome: "Carlos Andrade" });
    await login(page, conta);

    // Etapa 1: modelo e cliente
    await page.goto("/propostas/nova");
    await page.getByText("Reforma de banheiro", { exact: true }).click();
    await expect(page.getByLabel("Título da proposta")).toHaveValue("Reforma de banheiro");
    await page.getByLabel("Nome do cliente").fill("Mariana Costa");
    await page.getByLabel("E-mail do cliente").fill("Mariana@Example.com");
    await page.getByLabel(/WhatsApp do cliente/).fill("11987654321");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(new RegExp(`/propostas/${UUID}/editar\\?etapa=2$`));

    // Etapa 2: o modelo veio preenchido; acrescenta um item
    const escopo = page.getByLabel("O que será feito");
    await expect(escopo).toHaveValue(/Reforma completa do banheiro social/);
    await escopo.fill("Reforma completa do banheiro social, incluindo a pintura da laje.");
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await page.getByLabel("Descrição").last().fill("Pintura da laje");
    await page.getByLabel("Quantidade").last().fill("10");
    await page.getByLabel("Unidade").last().selectOption("m²");

    // Autosave: salva sozinho e sobrevive a um recarregamento
    await expect(salvo(page)).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByLabel("O que será feito")).toHaveValue(/pintura da laje/);
    await expect(page.getByLabel("Descrição").last()).toHaveValue("Pintura da laje");

    // Etapa 3: valores (10 m² × R$ 50,00 somam R$ 500,00 ao total do modelo, R$ 5.130,00)
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Valor por unidade").last().fill("5000");
    await expect(page.getByText("R$ 5.630,00").first()).toBeVisible();
    await page.getByLabel("Prazo", { exact: true }).fill("20 dias úteis");

    // Etapa 4: revisão
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Revisar", level: 2 })).toBeVisible();
    await expect(page.getByText("Pintura da laje").first()).toBeVisible();
    await expect(page.getByText("Falta preencher")).toHaveCount(0);
    await page.getByRole("button", { name: "Salvar rascunho e sair" }).click();
    await expect(page).toHaveURL(new RegExp(`/propostas/${UUID}$`));
    await expect(page.getByText("Pintura da laje").first()).toBeVisible();

    // Banco: dados do cliente normalizados e total recalculado pelo servidor
    const { data: proposta } = await service
      .from("propostas")
      .select("id, titulo, cliente_nome, cliente_email, cliente_telefone, status")
      .eq("prestador_id", conta.id)
      .single();
    expect(proposta).toMatchObject({
      titulo: "Reforma de banheiro",
      cliente_nome: "Mariana Costa",
      cliente_email: "mariana@example.com", // minúsculas
      cliente_telefone: "11987654321", // só dígitos
      status: "rascunho",
    });
    const { data: versao } = await service
      .from("proposta_versoes")
      .select("conteudo, enviada_em, hash_sha256")
      .eq("proposta_id", proposta!.id)
      .single();
    const c = versao!.conteudo as { valor_total_centavos: number; itens: unknown[]; prazo: string };
    expect(c.valor_total_centavos).toBe(563_000);
    expect(c.itens).toHaveLength(6);
    expect(c.prazo).toBe("20 dias úteis");
    expect(versao).toMatchObject({ enviada_em: null, hash_sha256: null });
  });

  test("não avança com campos vazios: aponta cada erro e foca o primeiro", async ({ page }) => {
    test.setTimeout(120_000);
    const conta = await criarConta();
    await login(page, conta);

    await page.goto("/propostas/nova");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Escolha um modelo ou comece do zero.").first()).toBeVisible();

    await page.getByText("Começar do zero", { exact: true }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Informe o nome do cliente.")).toBeVisible();
    await expect(page.getByText("Informe o e-mail do cliente.")).toBeVisible();
    await expect(page.getByText("Dê um título à proposta (pelo menos 3 letras).")).toBeVisible();

    await page.getByLabel("Nome do cliente").fill("Padaria Pão de Mel");
    await page.getByLabel("E-mail do cliente").fill("contato@paodemel.example.com");
    await page.getByLabel("Título da proposta").fill("Identidade visual");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/editar\?etapa=2$/);

    // Etapa 2 vazia: não passa
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.getByText("Descreva o que será feito (pelo menos 10 caracteres)."),
    ).toBeVisible();
    await expect(page.getByText("Inclua pelo menos um item.")).toBeVisible();
    await expect(page).toHaveURL(/etapa=2$/);
    await expect(page.getByLabel("O que será feito")).toBeFocused();

    // Item em branco também é apontado, no campo certo
    await page.getByLabel("O que será feito").fill("Criação do logotipo e do manual de marca.");
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Descreva o item.")).toBeVisible();
    await expect(page.getByLabel("Descrição")).toBeFocused();
  });

  test("conexão cai durante a edição: avisa, não perde nada e salva ao voltar", async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(isMobile, "comportamento igual no celular; verificado no desktop");
    test.setTimeout(120_000);
    const conta = await criarConta();
    const { id } = await semearProposta(conta.id, { status: "rascunho" });
    await login(page, conta);

    await page.goto(`/propostas/${id}/editar?etapa=2`);
    const escopo = page.getByLabel("O que será feito");
    await expect(escopo).toHaveValue(/Troca da tela/);

    await context.setOffline(true);
    await escopo.fill("Escopo digitado sem conexão, que não pode se perder.");
    await expect(
      page.getByRole("status").filter({ hasText: "Não conseguimos salvar agora" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(escopo).toHaveValue("Escopo digitado sem conexão, que não pode se perder.");

    await context.setOffline(false);
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(salvo(page)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByLabel("O que será feito")).toHaveValue(
      "Escopo digitado sem conexão, que não pode se perder.",
    );
  });

  test("proposta enviada não abre o assistente", async ({ page, isMobile }) => {
    test.skip(isMobile, "regra de servidor, igual no celular");
    const conta = await criarConta();
    const { id } = await semearProposta(conta.id, { status: "enviada" });
    await login(page, conta);
    await page.goto(`/propostas/${id}/editar`);
    await expect(page).toHaveURL(new RegExp(`/propostas/${id}$`));
  });

  test("pré-visualização: painel lateral no desktop, bottom sheet no celular; sem rolagem lateral", async ({
    page,
    isMobile,
  }) => {
    test.setTimeout(150_000);
    const conta = await criarConta();
    const { id } = await semearProposta(conta.id, { titulo: "Troca de tela iPhone 12" });
    await login(page, conta);

    await page.goto(`/propostas/${id}/editar?etapa=2`);
    const botao = page.getByRole("button", { name: "Ver como o cliente verá" });

    if (isMobile) {
      // Modo foco: só a barra de ações do assistente fica fixa no rodapé
      await expect(
        page.getByRole("navigation", { name: "Principal" }).filter({ visible: true }),
      ).toHaveCount(0);
      await botao.click();
      const folha = page.getByRole("dialog");
      await expect(folha.getByText("Como o cliente verá")).toBeVisible();
      await expect(folha.getByText("Troca de tela iPhone 12")).toBeVisible();
      await folha.getByRole("button", { name: "Fechar" }).click();
      await expect(folha).toBeHidden();
    } else {
      await expect(botao).toBeHidden();
      const lateral = page.getByRole("complementary", { name: "Pré-visualização do documento" });
      await expect(lateral).toBeVisible();
      await expect(lateral.getByText("Troca de tela iPhone 12")).toBeVisible();
      // A pré-visualização é ao vivo
      await page
        .getByLabel("O que será feito")
        .fill("Escopo novo, que aparece ao lado enquanto digita.");
      await expect(
        lateral.getByText("Escopo novo, que aparece ao lado enquanto digita."),
      ).toBeVisible();
    }

    for (const etapa of [1, 2, 3, 4]) {
      await page.goto(`/propostas/${id}/editar?etapa=${etapa}`);
      await expect(page.getByRole("heading", { level: 2 }).first()).toBeAttached();
      await semRolagemHorizontal(page);
    }
  });
});

test.describe("listagem", () => {
  test("busca, filtro por status, paginação e entrada hostil", async ({ page }) => {
    test.setTimeout(180_000);
    const conta = await criarConta();
    await Promise.all([
      semearProposta(conta.id, {
        titulo: "Reforma do banheiro",
        cliente: "Mariana Costa",
        status: "aceita",
        valorCentavos: 840_000,
      }),
      semearProposta(conta.id, {
        titulo: "Troca de tela iPhone 12",
        cliente: "Rafael Lima",
        status: "visualizada",
      }),
      semearProposta(conta.id, {
        titulo: "Instalação de split",
        cliente: "Condomínio Jardim",
        status: "ajuste_solicitado",
      }),
      ...Array.from({ length: 14 }, (_, i) =>
        semearProposta(conta.id, {
          titulo: `Orçamento avulso ${i + 1}`,
          cliente: "Cliente Avulso",
        }),
      ),
    ]);
    await login(page, conta);

    // Paginação: 17 propostas, 15 por página
    await page.goto("/propostas");
    await expect(page.getByText("17 propostas", { exact: true })).toBeVisible();
    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await page.getByRole("link", { name: "Próxima" }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    await semRolagemHorizontal(page);

    // Busca por cliente (parte do nome, sem diferenciar maiúsculas)
    await page.goto("/propostas");
    await page.getByLabel("Buscar por cliente ou título").fill("mariana");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/q=mariana/);
    await expect(page.getByText("1 proposta", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Reforma do banheiro/ }).first()).toBeVisible();

    // Busca por título + filtro por status, juntos
    await page.goto("/propostas?q=tela&status=visualizada");
    await expect(page.getByText("1 proposta · Visualizada")).toBeVisible();
    await page.goto("/propostas?q=tela&status=aceita");
    await expect(page.getByText("Nenhuma proposta encontrada.").first()).toBeVisible();
    await page.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/\/propostas$/);

    // Chip de status
    await page.getByRole("link", { name: "Aceita", exact: true }).click();
    await expect(page).toHaveURL(/status=aceita/);
    await expect(page.getByText("1 proposta · Aceita")).toBeVisible();

    // Entrada hostil: curingas do LIKE, aspas, vírgula, parênteses e status inválido não quebram
    for (const query of [
      "q=%25%2C()%22'%5C_",
      "q=a)%2Cstatus.eq.aceita",
      "status=nao-existe&pagina=-5",
      "pagina=9999",
    ]) {
      const resposta = await page.goto(`/propostas?${query}`);
      expect(resposta?.status(), query).toBeLessThan(500);
      await expect(page.getByRole("heading", { name: "Propostas" })).toBeAttached();
    }
  });

  test("outro prestador não vê nada: lista vazia, e a proposta alheia é 404", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "regra de servidor, igual no celular");
    const dona = await criarConta();
    const { id } = await semearProposta(dona.id, { titulo: "Proposta da outra pessoa" });
    const intruso = await criarConta({ nome: "Outra Pessoa" });
    await login(page, intruso);

    await page.goto("/propostas");
    await expect(page.getByText("Nenhuma proposta por aqui ainda.").first()).toBeVisible();

    for (const caminho of [
      `/propostas/${id}`,
      `/propostas/${id}/editar`,
      "/propostas/nao-e-um-id",
    ]) {
      const resposta = await page.goto(caminho);
      expect(resposta?.status(), caminho).toBe(404);
      await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    }
  });
});

test.describe("painel inicial", () => {
  test("números do mês e o que precisa de atenção", async ({ page }) => {
    test.setTimeout(150_000);
    const conta = await criarConta({ nome: "Carlos Andrade" });
    await Promise.all([
      semearProposta(conta.id, {
        titulo: "Reforma do banheiro",
        cliente: "Mariana Costa",
        status: "aceita",
        valorCentavos: 840_000,
      }),
      semearProposta(conta.id, {
        titulo: "Troca de tela iPhone 12",
        cliente: "Rafael Lima",
        status: "visualizada",
        validadeDias: 2,
      }),
      semearProposta(conta.id, {
        titulo: "Instalação de split",
        cliente: "Condomínio Jardim",
        status: "ajuste_solicitado",
      }),
      semearProposta(conta.id, {
        titulo: "Identidade visual",
        cliente: "Padaria Pão de Mel",
        status: "enviada",
        validadeDias: 10,
      }),
      semearProposta(conta.id, { titulo: "Rascunho qualquer", cliente: "Studio Aurora" }),
    ]);
    await login(page, conta);

    const resumo = page.getByRole("region", { name: "Resumo" });
    await expect(resumo.getByText("Aguardando resposta")).toBeVisible();
    // enviada + visualizada, ambas dentro da validade
    await expect(resumo.locator("p", { hasText: /^2$/ })).toBeVisible();
    await expect(resumo).toContainText("R$ 8.400,00");

    const atencao = page.getByRole("region", { name: "Precisa de atenção" });
    await expect(atencao.getByText("O cliente pediu ajuste")).toBeVisible();
    await expect(atencao.getByText("Vence em 2 dias, sem resposta")).toBeVisible();
    await expect(atencao.getByText("Identidade visual")).toHaveCount(0); // longe de vencer
    await expect(atencao.getByText("Rascunho qualquer")).toHaveCount(0);

    await page.getByRole("link", { name: "Ver todas" }).click();
    await expect(page).toHaveURL(/\/propostas$/);
  });

  test("sem propostas: convite para criar a primeira", async ({ page }) => {
    const conta = await criarConta();
    await login(page, conta);
    await expect(page.getByText("Nenhuma proposta por aqui ainda.")).toBeVisible();
    await page.getByRole("link", { name: "Criar a primeira proposta" }).click();
    await expect(page).toHaveURL(/\/propostas\/nova$/);
  });
});

test.describe("detalhe e versionamento", () => {
  test("nova versão de proposta enviada: a anterior continua intacta, com o mesmo hash", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "regra de servidor; o layout do detalhe é verificado em shell.spec");
    test.setTimeout(150_000);
    const conta = await criarConta();
    const enviada = await semearProposta(conta.id, { status: "enviada" });
    await login(page, conta);

    await page.goto(`/propostas/${enviada.id}`);
    await expect(page.getByText(enviada.hash!)).toBeVisible(); // hash da versão 1
    await expect(page.getByRole("button", { name: "Continuar editando" })).toHaveCount(0);
    await page.getByRole("button", { name: "Criar nova versão para editar" }).click();
    await expect(page).toHaveURL(new RegExp(`/propostas/${enviada.id}/editar\\?etapa=2$`));

    await page
      .getByLabel("O que será feito")
      .fill("Escopo da versão 2, depois do pedido de ajuste do cliente.");
    await expect(salvo(page)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "Sair do assistente" }).click();

    // Detalhe: agora é rascunho, com as duas versões
    await expect(page).toHaveURL(new RegExp(`/propostas/${enviada.id}$`));
    await expect(page.getByRole("link", { name: "Versão 1", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Versão 2 \(rascunho\)/ })).toBeVisible();
    await expect(
      page.getByText("Escopo da versão 2, depois do pedido de ajuste do cliente.").first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "Versão 1", exact: true }).click();
    await expect(page.getByText("Você está vendo uma versão anterior")).toBeVisible();
    await expect(page.getByText(enviada.hash!)).toBeVisible();
    await expect(page.getByText(/Troca da tela do aparelho/).first()).toBeVisible();

    // Banco: versão 1 intocada; versão 2 com o escopo novo e sem hash
    const { data: versoes } = await service
      .from("proposta_versoes")
      .select("numero, hash_sha256, enviada_em, conteudo")
      .eq("proposta_id", enviada.id)
      .order("numero");
    expect(versoes).toHaveLength(2);
    expect(versoes![0].hash_sha256).toBe(enviada.hash);
    expect(versoes![0].enviada_em).not.toBeNull();
    expect((versoes![0].conteudo as { escopo: string }).escopo).toMatch(/^Troca da tela/);
    expect(versoes![1]).toMatchObject({ hash_sha256: null, enviada_em: null });
    expect((versoes![1].conteudo as { escopo: string }).escopo).toMatch(/^Escopo da versão 2/);
  });

  test("proposta aceita não muda; rascunho nunca enviado pode ser excluído", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "regra de servidor, igual no celular");
    test.setTimeout(120_000);
    const conta = await criarConta();
    const aceita = await semearProposta(conta.id, { status: "aceita", titulo: "Reforma aceita" });
    const rascunho = await semearProposta(conta.id, { titulo: "Rascunho para excluir" });
    await login(page, conta);

    await page.goto(`/propostas/${aceita.id}`);
    await expect(page.getByText("Proposta aceita não pode ser alterada.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Criar nova versão/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Excluir rascunho" })).toHaveCount(0);

    await page.goto(`/propostas/${rascunho.id}`);
    await page.getByRole("button", { name: "Excluir rascunho" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Excluir este rascunho?")).toBeVisible();
    await dialogo.getByRole("button", { name: "Excluir rascunho" }).click();
    await expect(page).toHaveURL(/\/propostas\?excluida=1/);
    await expect(page.getByText("Rascunho excluído.")).toBeVisible();

    const { data } = await service.from("propostas").select("id").eq("id", rascunho.id);
    expect(data).toEqual([]);
    const { data: mantida } = await service.from("propostas").select("id").eq("id", aceita.id);
    expect(mantida).toHaveLength(1);
  });
});

test.describe("templates", () => {
  test("duplicar, personalizar, usar na proposta e excluir; modelo do Zelo é só leitura", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "fluxo igual no celular; telas verificadas em shell.spec");
    test.setTimeout(180_000);
    const conta = await criarConta();
    await login(page, conta);

    await page.goto("/templates");
    await expect(page.getByRole("heading", { name: "Reforma de banheiro" })).toBeVisible();
    await page
      .getByRole("button", { name: /Duplicar e personalizar.*Reforma de banheiro/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`/templates/${UUID}/editar$`));
    await expect(page.getByLabel("Nome do modelo")).toHaveValue(
      "Reforma de banheiro (personalizado)",
    );

    // Validação no próprio editor
    await page.getByLabel("Nome do modelo").fill("");
    await page.getByRole("button", { name: "Salvar modelo" }).click();
    await expect(page.getByText("Dê um nome ao modelo (pelo menos 3 letras).")).toBeVisible();
    await expect(page).toHaveURL(/\/editar$/);

    await page.getByLabel("Nome do modelo").fill("Meu banheiro");
    await page.getByRole("button", { name: "Salvar modelo" }).click();
    await expect(page).toHaveURL(/\/templates$/);
    await expect(page.getByRole("heading", { name: "Meu banheiro" })).toBeVisible();

    // Usar o modelo próprio na proposta
    await page.getByRole("link", { name: /Usar modelo Meu banheiro/ }).click();
    await expect(page).toHaveURL(/\/propostas\/nova\?modelo=/);
    await expect(page.getByRole("radio", { name: /Meu banheiro/ })).toBeChecked();
    await expect(page.getByLabel("Título da proposta")).toHaveValue("Meu banheiro");

    // Excluir
    await page.goto("/templates");
    await page.getByRole("button", { name: /Excluir.*Meu banheiro/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Excluir modelo" }).click();
    await expect(page).toHaveURL(/\/templates\?excluido=1/);
    await expect(page.getByText("Modelo excluído.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meu banheiro" })).toHaveCount(0);

    // Modelo global não abre no editor
    const { data: global } = await service
      .from("templates")
      .select("id")
      .is("dono_id", null)
      .limit(1)
      .single();
    await page.goto(`/templates/${global!.id}/editar`);
    await expect(page).toHaveURL(/\/templates$/);
  });
});

test.describe("unidade do item", () => {
  test("seletor mostra todas as unidades (dúzia, dezena, centena, milhar), grava a escolhida e aceita outra", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const conta = await criarConta();
    const { id } = await semearProposta(conta.id);
    await login(page, conta);
    await page.goto(`/propostas/${id}/editar?etapa=2`);

    const unidadeNoBanco = async () => {
      const { data } = await service
        .from("proposta_versoes")
        .select("conteudo")
        .eq("proposta_id", id)
        .single();
      return (data!.conteudo as { itens: { unidade: string }[] }).itens[0].unidade;
    };

    // O item já vem com "un" selecionada e, mesmo assim, a lista completa aparece
    const unidade = page.getByLabel("Unidade");
    await expect(unidade).toHaveValue("un");
    expect(await unidade.locator("option").allTextContents()).toEqual(
      expect.arrayContaining([
        "un",
        "m²",
        "kg",
        "dúzia (12)",
        "dezena (10)",
        "centena (100)",
        "milhar (1.000)",
        "Outra…",
      ]),
    );

    for (const valor of ["dúzia", "dezena", "centena", "milhar"]) {
      await unidade.selectOption(valor);
      await expect.poll(unidadeNoBanco, { timeout: 20_000 }).toBe(valor);
    }

    // A pré-visualização/documento usa a unidade escolhida
    await page.goto(`/propostas/${id}`);
    await expect(page.getByText(/1 milhar ×/)).toBeVisible();

    // "Outra…": texto livre, que também é gravado e continua aparecendo depois de recarregar
    await page.goto(`/propostas/${id}/editar?etapa=2`);
    await page.getByLabel("Unidade").selectOption("Outra…");
    await page.getByLabel("Unidade").fill("visita");
    await expect.poll(unidadeNoBanco, { timeout: 20_000 }).toBe("visita");
    await page.reload();
    await expect(page.getByLabel("Unidade")).toHaveValue("visita");

    // E dá para voltar para a lista
    await page.getByLabel("Unidade").selectOption("kg");
    await expect.poll(unidadeNoBanco, { timeout: 20_000 }).toBe("kg");
  });
});
