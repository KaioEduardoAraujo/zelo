import { describe, expect, it } from "vitest";

import { atencao } from "@/lib/proposals/attention";
import {
  conteudoVazio,
  etapaDoCampo,
  normalizarConteudo,
  validarEtapa,
  validarTudo,
  type DraftForm,
} from "@/lib/proposals/draft";
import { formatDecimal, parseDecimal } from "@/lib/masks";
import { conteudoPropostaSchema, conteudoTemplateSchema } from "@/lib/validation/proposta";

const completo: DraftForm = {
  clienteNome: "Mariana Costa",
  clienteEmail: "Mariana@Example.com",
  clienteTelefone: "11987654321",
  titulo: "Reforma do banheiro",
  conteudo: {
    escopo: "Reforma completa do banheiro social, com troca de piso e revestimento.",
    itens: [
      {
        descricao: "Demolição e retirada do entulho",
        unidade: "vb",
        quantidade: 1,
        valor_unitario_centavos: 120_000,
      },
      {
        descricao: "Assentamento de porcelanato",
        unidade: "m²",
        quantidade: 22.5,
        valor_unitario_centavos: 11_000,
      },
    ],
    exclusoes: ["Compra do porcelanato"],
    valor_total_centavos: 0, // propositalmente errado: o servidor recalcula
    prazo: "15 dias úteis",
    pagamento: "50% na aprovação e 50% na entrega",
    garantia: "12 meses",
    validade_dias: 15,
  },
};

describe("normalizarConteudo", () => {
  it("recalcula o total e ignora o que veio do navegador", () => {
    const c = normalizarConteudo({ ...completo.conteudo, valor_total_centavos: 1 });
    // 120000 + round(22,5 × 11000) = 120000 + 247500
    expect(c.valor_total_centavos).toBe(367_500);
  });

  it("descarta chaves desconhecidas (não entram no jsonb nem no hash)", () => {
    const c = normalizarConteudo({ ...completo.conteudo, role: "admin", __proto__: { x: 1 } });
    expect(Object.keys(c).sort()).toEqual(
      [
        "escopo",
        "exclusoes",
        "garantia",
        "itens",
        "pagamento",
        "prazo",
        "validade_dias",
        "valor_total_centavos",
      ].sort(),
    );
  });

  it("apara textos, remove exclusões vazias e limita a 2 casas", () => {
    const c = normalizarConteudo({
      ...completo.conteudo,
      escopo: "  escopo com espaços   ",
      exclusoes: ["  A  ", "   ", ""],
      itens: [{ descricao: " x ", unidade: "m", quantidade: 1.239, valor_unitario_centavos: 100 }],
    });
    expect(c.escopo).toBe("escopo com espaços");
    expect(c.exclusoes).toEqual(["A"]);
    expect(c.itens[0]).toMatchObject({ descricao: "x", quantidade: 1.24 });
  });

  it("um campo fora do limite NÃO apaga o resto do rascunho", () => {
    const c = normalizarConteudo({
      ...completo.conteudo,
      validade_dias: 120,
      escopo: "x".repeat(5000),
    });
    expect(c.validade_dias).toBe(120); // a validação é que reclama, com mensagem no campo
    expect(c.escopo).toHaveLength(5000);
    expect(c.itens).toHaveLength(2);
    expect(c.prazo).toBe("15 dias úteis");
  });

  it("aceita rascunho vazio ou malformado sem lançar erro", () => {
    expect(normalizarConteudo({})).toEqual(conteudoVazio());
    expect(normalizarConteudo(null)).toEqual(conteudoVazio());
    expect(normalizarConteudo({ itens: "não é lista" })).toEqual(conteudoVazio());
    expect(normalizarConteudo("texto")).toEqual(conteudoVazio());
  });
});

describe("validação por etapa", () => {
  it("rascunho em branco não passa de nenhuma etapa", () => {
    const vazio: DraftForm = {
      clienteNome: "",
      clienteEmail: "",
      clienteTelefone: "",
      titulo: "",
      conteudo: conteudoVazio(),
    };
    expect(Object.keys(validarEtapa(1, vazio)).sort()).toEqual([
      "cliente.email",
      "cliente.nome",
      "cliente.titulo",
    ]);
    expect(validarEtapa(2, vazio)).toMatchObject({
      escopo: expect.any(String),
      itens: "Inclua pelo menos um item.",
    });
    expect(validarEtapa(3, vazio)).toHaveProperty("valor_total_centavos");
  });

  it("proposta completa passa em todas as etapas", () => {
    for (const etapa of [1, 2, 3, 4] as const) expect(validarEtapa(etapa, completo)).toEqual({});
  });

  it("aponta o item e o campo exatos com problema", () => {
    const f = structuredClone(completo);
    f.conteudo.itens[1].descricao = "";
    f.conteudo.itens[1].quantidade = 0;
    expect(validarEtapa(2, f)).toMatchObject({
      "itens.1.descricao": "Descreva o item.",
      "itens.1.quantidade": "A quantidade precisa ser maior que zero.",
    });
  });

  it("preço dos itens é exigido na etapa 3, não na 2", () => {
    const f = structuredClone(completo);
    f.conteudo.itens.forEach((i) => (i.valor_unitario_centavos = 0));
    expect(validarEtapa(2, f)).toEqual({});
    expect(validarEtapa(3, f)).toHaveProperty(
      "valor_total_centavos",
      "Informe o valor de pelo menos um item.",
    );
  });

  it("texto longo demais é apontado no campo, não descartado", () => {
    const f = structuredClone(completo);
    f.conteudo.escopo = "x".repeat(4001);
    expect(validarEtapa(2, f)).toHaveProperty("escopo", "Use no máximo 4000 caracteres.");
  });

  it("validade fora de 1 a 90 dias é recusada", () => {
    const f = structuredClone(completo);
    f.conteudo.validade_dias = 120;
    expect(validarEtapa(3, f)).toHaveProperty("validade_dias", "A validade máxima é de 90 dias.");
  });

  it("validarTudo reúne cliente e conteúdo", () => {
    const f = structuredClone(completo);
    f.clienteEmail = "sem-arroba";
    f.conteudo.prazo = "";
    expect(Object.keys(validarTudo(f)).sort()).toEqual(["cliente.email", "prazo"]);
  });

  it("etapaDoCampo leva à etapa certa", () => {
    expect(etapaDoCampo("cliente.email")).toBe(1);
    expect(etapaDoCampo("escopo")).toBe(2);
    expect(etapaDoCampo("itens.0.descricao")).toBe(2);
    expect(etapaDoCampo("itens.0.valor_unitario_centavos")).toBe(3);
    expect(etapaDoCampo("prazo")).toBe(3);
  });
});

describe("conteúdo estrito (envio)", () => {
  it("o conteúdo normalizado de um formulário completo é aceito", () => {
    const r = conteudoPropostaSchema.safeParse(normalizarConteudo(completo.conteudo));
    expect(r.success).toBe(true);
  });

  it("total que não bate com a soma dos itens é recusado", () => {
    const c = { ...normalizarConteudo(completo.conteudo), valor_total_centavos: 1 };
    expect(conteudoPropostaSchema.safeParse(c).success).toBe(false);
  });

  it("template usa o mesmo formato (inclui validade_dias)", () => {
    expect(conteudoTemplateSchema).toBe(conteudoPropostaSchema);
  });
});

describe("parseDecimal / formatDecimal", () => {
  it.each([
    ["22,5", 22.5],
    ["22.5", 22.5],
    ["1.234,5", 1234.5],
    ["1.500", 1500],
    ["  7 ", 7],
    ["0,25", 0.25],
  ])("lê %j como %d", (texto, esperado) => {
    expect(parseDecimal(texto)).toBe(esperado);
  });

  it.each(["", "abc", "1,2,3", "-4", "12a"])("recusa %j", (texto) => {
    expect(parseDecimal(texto)).toBeNull();
  });

  it("formata em português", () => {
    expect(formatDecimal(22.5)).toBe("22,5");
    expect(formatDecimal(1234)).toBe("1.234");
  });
});

describe("atencao (precisa de atenção no painel)", () => {
  const agora = new Date("2026-11-16T12:00:00Z");
  const em = (dias: number) => new Date(agora.getTime() + dias * 864e5).toISOString();

  it("pedido de ajuste é sempre urgente", () => {
    expect(atencao({ status: "ajuste_solicitado", validadeEm: em(10) }, agora)).toEqual({
      motivo: "O cliente pediu ajuste",
      urgencia: "alta",
    });
  });

  it("perto de vencer, sem resposta", () => {
    expect(atencao({ status: "enviada", validadeEm: em(2) }, agora)?.motivo).toBe(
      "Vence em 2 dias, sem resposta",
    );
    expect(atencao({ status: "visualizada", validadeEm: em(1) }, agora)?.motivo).toBe(
      "Vence amanhã, sem resposta",
    );
  });

  it("visualizada e longe de vencer: atenção média", () => {
    expect(atencao({ status: "visualizada", validadeEm: em(10) }, agora)?.urgencia).toBe("media");
  });

  it("não alerta o que não depende do prestador", () => {
    expect(atencao({ status: "enviada", validadeEm: em(10) }, agora)).toBeNull();
    expect(atencao({ status: "aceita", validadeEm: em(1) }, agora)).toBeNull();
    expect(atencao({ status: "rascunho", validadeEm: null }, agora)).toBeNull();
  });

  it("proposta vencida não precisa mais de atenção", () => {
    expect(atencao({ status: "visualizada", validadeEm: em(-1) }, agora)).toBeNull();
  });
});
