import { beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  criarAceita,
  criarEnviada,
  criarRascunho,
  criarUsuario,
  type Usuario,
} from "./helpers";

let a: Usuario;
let b: Usuario;

beforeAll(async () => {
  [a, b] = await Promise.all([criarUsuario("Andrade Reformas"), criarUsuario("Bianca Designer")]);
});

describe("view propostas_situacao: valor da versão atual", () => {
  it("traz o valor_total_centavos da versão atual", async () => {
    const { proposta } = await criarRascunho(a);
    const { data } = await a.client
      .from("propostas_situacao")
      .select("valor_total_centavos")
      .eq("id", proposta.id)
      .single();
    expect(Number(data?.valor_total_centavos)).toBe(78000);
  });

  it("acompanha a versão nova: a atual passa a ser a que vale", async () => {
    const enviada = await criarEnviada(a);
    await a.client.from("proposta_versoes").insert({
      proposta_id: enviada.propostaId,
      numero: 2,
      conteudo: { valor_total_centavos: 123400 },
    });

    const { data } = await a.client
      .from("propostas_situacao")
      .select("valor_total_centavos, versao_atual")
      .eq("id", enviada.propostaId)
      .single();
    expect(data?.versao_atual).toBe(2);
    expect(Number(data?.valor_total_centavos)).toBe(123400);
  });

  it("valor que não é número não quebra a listagem (vira nulo)", async () => {
    const { proposta, versao } = await criarRascunho(a);
    const { error } = await a.client
      .from("proposta_versoes")
      .update({ conteudo: { valor_total_centavos: "abc" } })
      .eq("id", versao.id);
    expect(error).toBeNull();

    const { data, error: listError } = await a.client
      .from("propostas_situacao")
      .select("id, valor_total_centavos")
      .eq("prestador_id", a.id);
    expect(listError).toBeNull();
    expect(data?.find((p) => p.id === proposta.id)?.valor_total_centavos).toBeNull();
  });

  it("prestador B não vê as propostas de A pela view", async () => {
    const { proposta } = await criarRascunho(a);
    const { data } = await b.client.from("propostas_situacao").select("id").eq("id", proposta.id);
    expect(data).toEqual([]);
  });
});

describe("resumo_painel()", () => {
  it("conta o que aguarda resposta e soma o que foi aceito no mês", async () => {
    const novo = await criarUsuario("Painel Novo");
    const vazio = await novo.client.rpc("resumo_painel").single();
    expect(vazio.error).toBeNull();
    expect(vazio.data).toMatchObject({ aguardando: 0, aceitas_mes: 0 });
    expect(Number(vazio.data?.valor_aceito_mes_centavos)).toBe(0);

    await criarEnviada(novo); // aguardando (validade em 7 dias)
    await criarEnviada(novo); // aguardando
    await criarRascunho(novo); // rascunho não conta
    await criarAceita(novo); // 78000 aceitos agora

    const { data } = await novo.client.rpc("resumo_painel").single();
    expect(data).toMatchObject({ aguardando: 2, aceitas_mes: 1 });
    expect(Number(data?.valor_aceito_mes_centavos)).toBe(78000);
  });

  it("não mistura prestadores", async () => {
    const outro = await criarUsuario("Outro Prestador");
    await criarAceita(outro);
    const { data } = await b.client.rpc("resumo_painel").single();
    const { data: deOutro } = await outro.client.rpc("resumo_painel").single();
    expect(deOutro?.aceitas_mes).toBe(1);
    expect(data?.aceitas_mes).toBe(0);
  });

  it("visitante sem login não executa", async () => {
    const { error } = await anonClient().rpc("resumo_painel");
    expect(error).not.toBeNull();
  });
});
