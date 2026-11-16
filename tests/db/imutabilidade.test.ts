import { beforeAll, describe, expect, it } from "vitest";

import {
  criarAceita,
  criarEnviada,
  criarRascunho,
  criarUsuario,
  hashAleatorio,
  psql,
  serviceClient,
  type Usuario,
} from "./helpers";

/*
 * Prova da regra inegociável nº 1: o que foi enviado/aceito não muda.
 * Os testes usam a service_role DE PROPÓSITO: ela ignora o RLS, então se o bloqueio
 * funciona para ela, funciona para qualquer um (a proteção está nos triggers).
 */
let dono: Usuario;
let aceita: Awaited<ReturnType<typeof criarAceita>>;
const svc = () => serviceClient();

beforeAll(async () => {
  dono = await criarUsuario("Andrade Reformas");
  aceita = await criarAceita(dono);
});

describe("aceites são append-only", () => {
  it("UPDATE é bloqueado até para a service_role", async () => {
    const { error } = await svc()
      .from("aceites")
      .update({ cliente_nome: "Outra pessoa" })
      .eq("id", aceita.aceiteId);
    expect(error?.message).toMatch(/append-only/);
  });

  it("DELETE é bloqueado até para a service_role", async () => {
    const { error } = await svc().from("aceites").delete().eq("id", aceita.aceiteId);
    expect(error?.message).toMatch(/append-only/);
  });

  it("TRUNCATE é bloqueado até para o superusuário", () => {
    expect(() => psql("truncate public.aceites cascade")).toThrow(/append-only/);
  });
});

describe("auditoria_eventos é append-only", () => {
  it("UPDATE e DELETE bloqueados", async () => {
    const up = await svc()
      .from("auditoria_eventos")
      .update({ tipo: "recusada" })
      .eq("id", aceita.eventoId);
    expect(up.error?.message).toMatch(/append-only/);

    const del = await svc().from("auditoria_eventos").delete().eq("id", aceita.eventoId);
    expect(del.error?.message).toMatch(/append-only/);
  });

  it("criado_em é sempre o horário do banco", async () => {
    const { data } = await svc()
      .from("auditoria_eventos")
      .insert({ proposta_id: aceita.propostaId, tipo: "aberta", criado_em: "2020-01-01T00:00:00Z" })
      .select("criado_em")
      .single();
    expect(new Date(data!.criado_em).getFullYear()).toBeGreaterThan(2020);
  });
});

describe("versão enviada é imutável", () => {
  it("o prestador não edita o conteúdo", async () => {
    const { error } = await dono.client
      .from("proposta_versoes")
      .update({ conteudo: { escopo: "mudei depois" } })
      .eq("id", aceita.versaoId);
    expect(error?.message).toMatch(/imutável/);
  });

  it("nem a service_role edita ou apaga", async () => {
    const up = await svc()
      .from("proposta_versoes")
      .update({ hash_sha256: hashAleatorio() })
      .eq("id", aceita.versaoId);
    expect(up.error?.message).toMatch(/imutável/);

    const del = await svc().from("proposta_versoes").delete().eq("id", aceita.versaoId);
    expect(del.error?.message).toMatch(/imutável/);
  });

  it("apagar a proposta não leva a versão junto", async () => {
    const { error } = await svc().from("propostas").delete().eq("id", aceita.propostaId);
    expect(error).not.toBeNull();
    const { data } = await svc().from("proposta_versoes").select("id").eq("id", aceita.versaoId);
    expect(data).toHaveLength(1);
  });

  it("rascunho continua editável", async () => {
    const { versao } = await criarRascunho(dono);
    const { error } = await dono.client
      .from("proposta_versoes")
      .update({ conteudo: { escopo: "ajustei o rascunho" } })
      .eq("id", versao.id);
    expect(error).toBeNull();
  });
});

describe("status só reflete respostas reais do cliente", () => {
  it("prestador não marca a própria proposta como aceita", async () => {
    const enviada = await criarEnviada(dono);
    const { error } = await dono.client
      .from("propostas")
      .update({ status: "aceita" })
      .eq("id", enviada.propostaId);
    expect(error?.message).toMatch(/resposta do cliente/);
  });

  it("nem o servidor marca como aceita sem um aceite registrado", async () => {
    const enviada = await criarEnviada(dono);
    const { error } = await svc()
      .from("propostas")
      .update({ status: "aceita" })
      .eq("id", enviada.propostaId);
    expect(error?.message).toMatch(/exige a resposta correspondente/);
  });

  it("aceite com hash diferente do documento é recusado", async () => {
    const enviada = await criarEnviada(dono);
    const { error } = await svc().from("aceites").insert({
      versao_id: enviada.versaoId,
      resultado: "aceito",
      cliente_nome: "Mariana Costa",
      cliente_cpf: "12345678909",
      otp_verificado_em: new Date().toISOString(),
      texto_consentimento: "Li e aceito.",
      hash_documento: hashAleatorio(),
    });
    expect(error?.message).toMatch(/hash do documento não confere/);
  });

  it("proposta aceita não muda mais de status nem ganha nova versão", async () => {
    const status = await svc()
      .from("propostas")
      .update({ status: "recusada" })
      .eq("id", aceita.propostaId);
    expect(status.error?.message).toMatch(/aceita não muda/);

    const versao = await dono.client
      .from("proposta_versoes")
      .insert({ proposta_id: aceita.propostaId, numero: 2 });
    expect(versao.error?.message).toMatch(/use um aditivo/);
  });

  it("dados do cliente não mudam depois do envio", async () => {
    const enviada = await criarEnviada(dono);
    const { error } = await dono.client
      .from("propostas")
      .update({ cliente_email: "outro@example.com" })
      .eq("id", enviada.propostaId);
    expect(error?.message).toMatch(/só podem mudar em rascunho/);
  });
});

describe("versionamento", () => {
  it("nova versão volta a proposta para rascunho e preserva a anterior", async () => {
    const enviada = await criarEnviada(dono);

    const { data: v2, error } = await dono.client
      .from("proposta_versoes")
      .insert({ proposta_id: enviada.propostaId, numero: 99, conteudo: { escopo: "versão 2" } })
      .select()
      .single();
    expect(error).toBeNull();
    expect(v2?.numero).toBe(2); // o banco define o número, não a aplicação

    const { data: proposta } = await dono.client
      .from("propostas")
      .select("status, versao_atual")
      .eq("id", enviada.propostaId)
      .single();
    expect(proposta).toEqual({ status: "rascunho", versao_atual: 2 });

    const { data: v1 } = await dono.client
      .from("proposta_versoes")
      .select("hash_sha256, enviada_em")
      .eq("id", enviada.versaoId)
      .single();
    expect(v1?.hash_sha256).toBe(enviada.hash);
    expect(v1?.enviada_em).not.toBeNull();
  });

  it("não permite duas versões em rascunho", async () => {
    const { proposta } = await criarRascunho(dono);
    const { error } = await dono.client
      .from("proposta_versoes")
      .insert({ proposta_id: proposta.id, numero: 2 });
    expect(error?.message).toMatch(/já existe uma versão em rascunho/);
  });

  it("versão nasce como rascunho mesmo se a aplicação mandar enviada_em", async () => {
    const { proposta } = await dono.client
      .from("propostas")
      .insert({
        prestador_id: dono.id,
        cliente_nome: "João",
        cliente_email: "joao@example.com",
        titulo: "Teste",
      })
      .select()
      .single()
      .then((r) => ({ proposta: r.data! }));
    const { data } = await dono.client
      .from("proposta_versoes")
      .insert({
        proposta_id: proposta.id,
        numero: 1,
        enviada_em: new Date().toISOString(),
        hash_sha256: hashAleatorio(),
      })
      .select("enviada_em, hash_sha256")
      .single();
    expect(data).toEqual({ enviada_em: null, hash_sha256: null });
  });
});

describe("aditivo", () => {
  it("só pode apontar para proposta aceita do mesmo prestador", async () => {
    const outro = await criarUsuario("Outro Prestador");
    const { error } = await outro.client.from("propostas").insert({
      prestador_id: outro.id,
      tipo: "aditivo",
      proposta_pai_id: aceita.propostaId,
      cliente_nome: "Mariana Costa",
      cliente_email: "mariana@example.com",
      titulo: "Aditivo intruso",
    });
    expect(error?.message).toMatch(/proposta aceita do mesmo prestador/);

    const ok = await dono.client.from("propostas").insert({
      prestador_id: dono.id,
      tipo: "aditivo",
      proposta_pai_id: aceita.propostaId,
      cliente_nome: "Mariana Costa",
      cliente_email: "mariana@example.com",
      titulo: "Troca do registro do chuveiro",
    });
    expect(ok.error).toBeNull();
  });
});
