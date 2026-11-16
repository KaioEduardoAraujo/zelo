import { beforeAll, describe, expect, it } from "vitest";

import { hashConfere, hashDocumento } from "@/lib/crypto/hash";

import {
  anonClient,
  criarAceita,
  criarAdmin,
  criarEnviada,
  criarRascunho,
  criarUsuario,
  hashAleatorio,
  serviceClient,
  type Usuario,
} from "./helpers";

/*
 * Fase 5: enviar_versao() e regenerar_link(). Provam que o envio é atômico, que só o dono envia,
 * que o hash recalculado depois continua batendo (mesmo passando pelo jsonb do Postgres) e que
 * um link novo invalida o anterior.
 */
let a: Usuario;
let b: Usuario;
let admin: Usuario;

beforeAll(async () => {
  [a, b, admin] = await Promise.all([
    criarUsuario("Andrade Reformas"),
    criarUsuario("Bianca Designer"),
    criarAdmin(),
  ]);
});

/** Documento como a aplicação o monta: conteúdo estrito + retrato das partes (decisão D24). */
function documentoDe(propostaId: string, versao: number, patch: Record<string, unknown> = {}) {
  return {
    escopo: "Reforma completa do banheiro social, com troca de piso e revestimento.",
    itens: [
      {
        descricao: "Demolição e retirada do entulho",
        unidade: "vb",
        quantidade: 1,
        valor_unitario_centavos: 120_000,
      },
      {
        descricao: "Porcelanato “retificado” ✓",
        unidade: "m²",
        quantidade: 22.5,
        valor_unitario_centavos: 11_000,
      },
    ],
    exclusoes: ["Compra do porcelanato"],
    valor_total_centavos: 367_500,
    prazo: "15 dias úteis",
    pagamento: "50% na aprovação e 50% na entrega",
    garantia: "12 meses",
    validade_dias: 15,
    proposta_id: propostaId,
    versao,
    titulo: "Reforma do banheiro",
    prestador: { nome: "Andrade Reformas", empresa: null },
    cliente: { nome: "Mariana Costa", email: "mariana@example.com", telefone: "11987654321" },
    ...patch,
  };
}

async function enviar(
  quem: Usuario,
  propostaId: string,
  documento: unknown,
  over: { hash?: string; tokenHash?: string; ip?: string; ua?: string } = {},
) {
  return quem.client
    .rpc("enviar_versao", {
      p_proposta_id: propostaId,
      p_documento: documento as never,
      p_hash: over.hash ?? hashDocumento(documento),
      p_token_hash: over.tokenHash ?? hashAleatorio(),
      p_ip: over.ip,
      p_user_agent: over.ua,
    })
    .single();
}

describe("enviar_versao: o caminho feliz", () => {
  it("trava a versão, grava o hash, gera o link e registra o evento, tudo de uma vez", async () => {
    const { proposta, versao } = await criarRascunho(a);
    const doc = documentoDe(proposta.id, 1);
    const hash = hashDocumento(doc);
    const tokenHash = hashAleatorio();

    const { data, error } = await enviar(a, proposta.id, doc, {
      hash,
      tokenHash,
      ip: "177.92.40.18",
      ua: "Mozilla/5.0 (Linux; Android 15) Chrome/131",
    });
    expect(error).toBeNull();
    expect(data?.r_numero).toBe(1);

    // validade = momento do envio + validade_dias do documento
    const dias =
      (new Date(data!.r_validade_em).getTime() - new Date(data!.r_enviada_em).getTime()) / 864e5;
    expect(dias).toBeCloseTo(15, 4);

    const svc = serviceClient();
    const { data: p } = await svc
      .from("propostas")
      .select("status, token_hash, validade_em")
      .eq("id", proposta.id)
      .single();
    expect(p).toMatchObject({ status: "enviada", token_hash: tokenHash });
    expect(new Date(p!.validade_em!).getTime()).toBe(new Date(data!.r_validade_em).getTime());

    const { data: v } = await svc
      .from("proposta_versoes")
      .select("hash_sha256, enviada_em, conteudo")
      .eq("id", versao.id)
      .single();
    expect(v?.hash_sha256).toBe(hash);
    expect(v?.enviada_em).not.toBeNull();

    const { data: eventos } = await a.client
      .from("auditoria_eventos")
      .select("tipo, ip, user_agent, metadados")
      .eq("proposta_id", proposta.id);
    expect(eventos).toHaveLength(1);
    expect(eventos![0]).toMatchObject({
      tipo: "enviada",
      ip: "177.92.40.18",
      user_agent: expect.stringContaining("Android 15"),
      metadados: { versao: 1, hash_sha256: hash },
    });
  });

  it("o hash recalculado DEPOIS de passar pelo jsonb do Postgres continua batendo", async () => {
    // Acentos, aspas curvas, emoji, 22,5 m² e chaves fora de ordem: tudo o que poderia mudar de
    // forma ao ser guardado e lido de volta. Se mudasse, o verificador (Fase 7) reprovaria
    // documentos legítimos.
    const { proposta, versao } = await criarRascunho(a);
    const doc = documentoDe(proposta.id, 1, {
      escopo: "Troca de piso em área “molhada” ✓ — inclui rodapé, 100% do cômodo.",
      observacoes: "Cliente pediu 😀 acabamento fosco",
    });
    const { error } = await enviar(a, proposta.id, doc);
    expect(error).toBeNull();

    const { data: v } = await serviceClient()
      .from("proposta_versoes")
      .select("conteudo, hash_sha256")
      .eq("id", versao.id)
      .single();
    expect(hashDocumento(v!.conteudo)).toBe(hashDocumento(doc));
    expect(hashConfere(v!.conteudo, v!.hash_sha256)).toBe(true);
  });

  it("depois do envio a versão é imutável e a proposta não volta a rascunho sozinha", async () => {
    const { proposta, versao } = await criarRascunho(a);
    await enviar(a, proposta.id, documentoDe(proposta.id, 1));

    const edit = await a.client
      .from("proposta_versoes")
      .update({ conteudo: { escopo: "mudei" } })
      .eq("id", versao.id);
    expect(edit.error?.message).toMatch(/imutável/);
    const volta = await a.client
      .from("propostas")
      .update({ status: "rascunho" })
      .eq("id", proposta.id);
    expect(volta.error).not.toBeNull();
  });

  it("enviar a versão 2 troca o link e deixa a versão 1 intacta", async () => {
    const enviada = await criarEnviada(a);
    const antes = await serviceClient()
      .from("propostas")
      .select("token_hash")
      .eq("id", enviada.propostaId)
      .single();

    const { error: erroNova } = await a.client
      .from("proposta_versoes")
      .insert({ proposta_id: enviada.propostaId, numero: 2, conteudo: { escopo: "versão 2" } });
    expect(erroNova).toBeNull();

    const doc2 = documentoDe(enviada.propostaId, 2, { prazo: "20 dias úteis" });
    const { data, error } = await enviar(a, enviada.propostaId, doc2);
    expect(error).toBeNull();
    expect(data?.r_numero).toBe(2);

    const svc = serviceClient();
    const { data: depois } = await svc
      .from("propostas")
      .select("token_hash, status, versao_atual")
      .eq("id", enviada.propostaId)
      .single();
    expect(depois).toMatchObject({ status: "enviada", versao_atual: 2 });
    expect(depois?.token_hash).not.toBe(antes.data?.token_hash); // o link da versão 1 morreu

    const { data: v1 } = await svc
      .from("proposta_versoes")
      .select("hash_sha256")
      .eq("proposta_id", enviada.propostaId)
      .eq("numero", 1)
      .single();
    expect(v1?.hash_sha256).toBe(enviada.hash);

    const { data: eventos } = await svc
      .from("auditoria_eventos")
      .select("tipo")
      .eq("proposta_id", enviada.propostaId);
    expect(eventos?.filter((e) => e.tipo === "enviada")).toHaveLength(1); // o da v2 (a v1 foi semeada sem evento)
  });
});

describe("enviar_versao: o que NÃO pode acontecer", () => {
  it("não envia duas vezes a mesma proposta", async () => {
    const { proposta } = await criarRascunho(a);
    const doc = documentoDe(proposta.id, 1);
    expect((await enviar(a, proposta.id, doc)).error).toBeNull();
    const segunda = await enviar(a, proposta.id, doc);
    expect(segunda.error?.message).toMatch(/não está em rascunho/);

    const { data } = await a.client
      .from("auditoria_eventos")
      .select("id")
      .eq("proposta_id", proposta.id);
    expect(data).toHaveLength(1);
  });

  it("duas chamadas ao mesmo tempo: só uma vence", async () => {
    const { proposta } = await criarRascunho(a);
    const doc = documentoDe(proposta.id, 1);
    const resultados = await Promise.all([
      enviar(a, proposta.id, doc),
      enviar(a, proposta.id, doc),
    ]);
    expect(resultados.filter((r) => r.error === null)).toHaveLength(1);
    const { data } = await a.client
      .from("auditoria_eventos")
      .select("id")
      .eq("proposta_id", proposta.id);
    expect(data).toHaveLength(1);
  });

  it("outro prestador não envia a proposta alheia, e a resposta não revela se ela existe", async () => {
    const { proposta } = await criarRascunho(a);
    const doc = documentoDe(proposta.id, 1);
    const alheia = await enviar(b, proposta.id, doc);
    const inexistente = await enviar(b, "00000000-0000-4000-8000-000000000000", doc);
    expect(alheia.error?.code).toBe("42501");
    expect(alheia.error?.message).toBe("proposta não encontrada");
    expect(inexistente.error?.message).toBe(alheia.error?.message);

    const { data } = await serviceClient()
      .from("propostas")
      .select("status")
      .eq("id", proposta.id)
      .single();
    expect(data?.status).toBe("rascunho");
  });

  it("visitante sem login não executa", async () => {
    const { proposta } = await criarRascunho(a);
    const { error } = await anonClient().rpc("enviar_versao", {
      p_proposta_id: proposta.id,
      p_documento: documentoDe(proposta.id, 1) as never,
      p_hash: hashAleatorio(),
      p_token_hash: hashAleatorio(),
    });
    expect(error).not.toBeNull();
  });

  it("conta suspensa não envia", async () => {
    const suspensa = await criarUsuario("Conta Suspensa");
    const { proposta } = await criarRascunho(suspensa);
    await admin.client.from("profiles").update({ ativo: false }).eq("id", suspensa.id);
    const { error } = await enviar(suspensa, proposta.id, documentoDe(proposta.id, 1));
    expect(error?.message).toMatch(/apenas prestadores ativos/);
  });

  it.each([
    ["hash fora do formato", { hash: "abc" }],
    ["hash em maiúsculas", { hash: "A".repeat(64) }],
    ["hash do link fora do formato", { tokenHash: "zzzz" }],
  ])("recusa %s", async (_nome, over) => {
    const { proposta } = await criarRascunho(a);
    const { error } = await enviar(a, proposta.id, documentoDe(proposta.id, 1), over);
    expect(error?.message).toMatch(/formato inválido/);
  });

  it("recusa documento que declara ser de outra proposta", async () => {
    const { proposta } = await criarRascunho(a);
    const doc = documentoDe("11111111-1111-4111-8111-111111111111", 1);
    const { error } = await enviar(a, proposta.id, doc);
    expect(error?.message).toMatch(/não corresponde a esta versão/);
  });

  it("recusa documento que declara ser de outra versão", async () => {
    const { proposta } = await criarRascunho(a);
    const { error } = await enviar(a, proposta.id, documentoDe(proposta.id, 2));
    expect(error?.message).toMatch(/não corresponde a esta versão/);
  });

  it.each([0, 91, 15.5, "15", null])("recusa validade_dias = %j", async (dias) => {
    const { proposta } = await criarRascunho(a);
    const { error } = await enviar(
      a,
      proposta.id,
      documentoDe(proposta.id, 1, { validade_dias: dias }),
    );
    expect(error?.message).toMatch(/validade inválida/);
  });

  it("recusa documento que não é um objeto", async () => {
    const { proposta } = await criarRascunho(a);
    const { error } = await enviar(a, proposta.id, ["não", "é", "objeto"]);
    expect(error?.message).toMatch(/documento inválido/);
  });

  it("nada fica pela metade quando o envio é recusado", async () => {
    const { proposta, versao } = await criarRascunho(a);
    await enviar(a, proposta.id, documentoDe(proposta.id, 1, { validade_dias: 999 }));
    const svc = serviceClient();
    const { data: p } = await svc
      .from("propostas")
      .select("status, token_hash, validade_em")
      .eq("id", proposta.id)
      .single();
    expect(p).toEqual({ status: "rascunho", token_hash: null, validade_em: null });
    const { data: v } = await svc
      .from("proposta_versoes")
      .select("hash_sha256, enviada_em")
      .eq("id", versao.id)
      .single();
    expect(v).toEqual({ hash_sha256: null, enviada_em: null });
    const { data: e } = await svc
      .from("auditoria_eventos")
      .select("id")
      .eq("proposta_id", proposta.id);
    expect(e).toEqual([]);
  });
});

describe("regenerar_link", () => {
  const regenerar = (quem: Usuario, id: string, tokenHash = hashAleatorio()) =>
    quem.client
      .rpc("regenerar_link", { p_proposta_id: id, p_token_hash: tokenHash, p_ip: "177.92.40.18" })
      .single();

  it("troca o link, mantém a validade e registra o evento; o link antigo deixa de existir", async () => {
    const enviada = await criarEnviada(a);
    const svc = serviceClient();
    const { data: antes } = await svc
      .from("propostas")
      .select("token_hash, validade_em")
      .eq("id", enviada.propostaId)
      .single();

    const novo = hashAleatorio();
    const { data, error } = await regenerar(a, enviada.propostaId, novo);
    expect(error).toBeNull();
    expect(data?.r_numero).toBe(1);

    const { data: depois } = await svc
      .from("propostas")
      .select("token_hash, validade_em")
      .eq("id", enviada.propostaId)
      .single();
    expect(depois?.token_hash).toBe(novo);
    expect(depois?.validade_em).toBe(antes?.validade_em); // novo link não estende a validade

    const { data: achado } = await svc
      .from("propostas")
      .select("id")
      .eq("token_hash", antes!.token_hash!);
    expect(achado).toEqual([]); // o hash do link antigo não aponta para mais nada

    const { data: eventos } = await a.client
      .from("auditoria_eventos")
      .select("tipo, ip")
      .eq("proposta_id", enviada.propostaId);
    expect(eventos).toEqual([{ tipo: "link_regenerado", ip: "177.92.40.18" }]);
  });

  it("não vale para rascunho, proposta aceita, vencida ou alheia", async () => {
    const { proposta } = await criarRascunho(a);
    expect((await regenerar(a, proposta.id)).error?.message).toMatch(/não aceita um novo link/);

    const aceita = await criarAceita(a);
    expect((await regenerar(a, aceita.propostaId)).error?.message).toMatch(
      /não aceita um novo link/,
    );

    const vencida = await criarEnviada(a);
    await serviceClient()
      .from("propostas")
      .update({ validade_em: new Date(Date.now() - 864e5).toISOString() })
      .eq("id", vencida.propostaId);
    expect((await regenerar(a, vencida.propostaId)).error?.message).toMatch(/venceu/);

    const alheia = await criarEnviada(a);
    const naoDono = await regenerar(b, alheia.propostaId);
    expect(naoDono.error?.code).toBe("42501");
    expect(naoDono.error?.message).toBe("proposta não encontrada");
  });

  it("recusa hash fora do formato e visitante sem login", async () => {
    const enviada = await criarEnviada(a);
    expect((await regenerar(a, enviada.propostaId, "xyz")).error?.message).toMatch(
      /formato inválido/,
    );
    const { error } = await anonClient().rpc("regenerar_link", {
      p_proposta_id: enviada.propostaId,
      p_token_hash: hashAleatorio(),
    });
    expect(error).not.toBeNull();
  });
});

describe("exposição das funções pela API", () => {
  it("o schema `private` não responde pela API: só os invólucros públicos são chamáveis", async () => {
    const { proposta } = await criarRascunho(a);
    const { error } = await a.client.schema("private" as never).rpc(
      "enviar_versao" as never,
      {
        p_proposta_id: proposta.id,
        p_documento: documentoDe(proposta.id, 1),
        p_hash: hashAleatorio(),
        p_token_hash: hashAleatorio(),
      } as never,
    );
    expect(error).not.toBeNull();

    const { data } = await serviceClient()
      .from("propostas")
      .select("status")
      .eq("id", proposta.id)
      .single();
    expect(data?.status).toBe("rascunho");
  });
});
