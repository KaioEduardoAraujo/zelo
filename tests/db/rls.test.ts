import { beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  criarAceita,
  criarAdmin,
  criarUsuario,
  serviceClient,
  type Usuario,
} from "./helpers";

// A tem uma proposta aceita; B tenta de tudo.
let a: Usuario;
let b: Usuario;
let admin: Usuario;
let doA: Awaited<ReturnType<typeof criarAceita>>;

beforeAll(async () => {
  [a, b, admin] = await Promise.all([
    criarUsuario("Andrade Reformas"),
    criarUsuario("Bianca Designer"),
    criarAdmin(),
  ]);
  doA = await criarAceita(a);
});

describe("prestador B não enxerga nada do prestador A", () => {
  it("propostas", async () => {
    const { data, error } = await b.client.from("propostas").select().eq("id", doA.propostaId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("view propostas_situacao", async () => {
    const { data } = await b.client.from("propostas_situacao").select().eq("id", doA.propostaId);
    expect(data).toEqual([]);
  });

  it("versões", async () => {
    const { data } = await b.client.from("proposta_versoes").select().eq("id", doA.versaoId);
    expect(data).toEqual([]);
  });

  it("aceites", async () => {
    const { data } = await b.client.from("aceites").select().eq("id", doA.aceiteId);
    expect(data).toEqual([]);
  });

  it("auditoria", async () => {
    const { data } = await b.client.from("auditoria_eventos").select().eq("id", doA.eventoId);
    expect(data).toEqual([]);
  });

  it("perfil", async () => {
    const { data } = await b.client.from("profiles").select().eq("id", a.id);
    expect(data).toEqual([]);
  });
});

describe("prestador B não altera nada do prestador A", () => {
  it("não muda o título da proposta de A (nenhuma linha afetada)", async () => {
    const { data } = await b.client
      .from("propostas")
      .update({ titulo: "Invadido" })
      .eq("id", doA.propostaId)
      .select();
    expect(data).toEqual([]);

    const { data: real } = await serviceClient()
      .from("propostas")
      .select("titulo")
      .eq("id", doA.propostaId)
      .single();
    expect(real?.titulo).toBe("Troca de tela iPhone 12");
  });

  it("não cria proposta em nome de A", async () => {
    const { error } = await b.client.from("propostas").insert({
      prestador_id: a.id,
      cliente_nome: "Fulano",
      cliente_email: "fulano@example.com",
      titulo: "Proposta falsa",
    });
    expect(error?.code).toBe("42501"); // violação de política RLS
  });

  it("não cria versão na proposta de A", async () => {
    const { error } = await b.client
      .from("proposta_versoes")
      .insert({ proposta_id: doA.propostaId, numero: 2 });
    expect(error?.code).toBe("42501");
  });

  it("não apaga a proposta de A", async () => {
    const { data } = await b.client.from("propostas").delete().eq("id", doA.propostaId).select();
    expect(data).toEqual([]);
  });
});

describe("dono e permissões do próprio prestador", () => {
  it("A vê a própria proposta, versão, aceite e evento", async () => {
    const [p, v, ac, ev] = await Promise.all([
      a.client.from("propostas").select().eq("id", doA.propostaId),
      a.client.from("proposta_versoes").select().eq("id", doA.versaoId),
      a.client.from("aceites").select().eq("id", doA.aceiteId),
      a.client.from("auditoria_eventos").select().eq("id", doA.eventoId),
    ]);
    expect(p.data).toHaveLength(1);
    expect(v.data).toHaveLength(1);
    expect(ac.data).toHaveLength(1);
    expect(ev.data).toHaveLength(1);
  });

  it("A não grava aceites nem auditoria (só o servidor grava)", async () => {
    const aceite = await a.client.from("aceites").insert({
      versao_id: doA.versaoId,
      resultado: "aceito",
      cliente_nome: "Eu mesmo",
      cliente_cpf: "12345678909",
      otp_verificado_em: new Date().toISOString(),
      texto_consentimento: "x",
      hash_documento: doA.hash,
    });
    expect(aceite.error?.code).toBe("42501");

    const evento = await a.client
      .from("auditoria_eventos")
      .insert({ proposta_id: doA.propostaId, tipo: "aberta" });
    expect(evento.error?.code).toBe("42501");
  });

  it("ninguém logado lê otp_codigos", async () => {
    const { error } = await a.client.from("otp_codigos").select();
    expect(error?.code).toBe("42501");
  });

  it("A não vira admin nem se reativa", async () => {
    const role = await a.client.from("profiles").update({ role: "admin" }).eq("id", a.id);
    expect(role.error?.code).toBe("42501");

    const ativo = await a.client.from("profiles").update({ ativo: false }).eq("id", a.id);
    expect(ativo.error?.code).toBe("42501");
  });

  it("A edita o próprio nome", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ nome: "Andrade Reformas e Pinturas" })
      .eq("id", a.id);
    expect(error).toBeNull();
  });

  it("cadastro com role=admin nos metadados vira prestador", async () => {
    const espertinho = await criarUsuario("Espertinho", { role: "admin" });
    const { data } = await espertinho.client
      .from("profiles")
      .select("role")
      .eq("id", espertinho.id)
      .single();
    expect(data?.role).toBe("prestador");
  });
});

describe("funções auxiliares do RLS ficam fora da API", () => {
  it("nem anon nem logado chamam is_admin / eh_dono_da_proposta via /rpc", async () => {
    const anon = await anonClient().rpc("is_admin" as never);
    expect(anon.error).not.toBeNull();
    const logado = await a.client.rpc(
      "eh_dono_da_proposta" as never,
      { p_proposta_id: doA.propostaId } as never,
    );
    expect(logado.error).not.toBeNull();
  });
});

describe("visitante sem login (anon)", () => {
  it("não acessa nenhuma tabela diretamente", async () => {
    const anon = anonClient();
    for (const tabela of [
      "propostas",
      "proposta_versoes",
      "aceites",
      "auditoria_eventos",
      "profiles",
      "templates",
    ] as const) {
      const { error } = await anon.from(tabela).select().limit(1);
      expect(error?.code, tabela).toBe("42501");
    }
  });
});

describe("administrador", () => {
  it("vê a lista de prestadores, mas não o conteúdo das propostas", async () => {
    const perfis = await admin.client.from("profiles").select("id").in("id", [a.id, b.id]);
    expect(perfis.data).toHaveLength(2);

    const propostas = await admin.client.from("propostas").select().eq("id", doA.propostaId);
    expect(propostas.data).toEqual([]);
  });

  it("vê as contagens pelo resumo", async () => {
    const { data, error } = await admin.client.rpc("admin_resumo_prestadores");
    expect(error).toBeNull();
    const linhaA = data?.find((l) => l.id === a.id);
    expect(linhaA).toMatchObject({ total_propostas: 1, total_aceites: 1, ativo: true });
  });

  it("prestador não chama o resumo do admin", async () => {
    const { error } = await a.client.rpc("admin_resumo_prestadores");
    expect(error?.code).toBe("42501");
  });

  it("admin não altera dados do prestador, só o status", async () => {
    const { error } = await admin.client
      .from("profiles")
      .update({ nome: "Outro nome" })
      .eq("id", b.id);
    expect(error?.code).toBe("42501");
  });

  it("conta suspensa não cria proposta", async () => {
    const suspensa = await criarUsuario("Conta Suspensa");
    const { error: e1 } = await admin.client
      .from("profiles")
      .update({ ativo: false })
      .eq("id", suspensa.id);
    expect(e1).toBeNull();

    const { error } = await suspensa.client.from("propostas").insert({
      prestador_id: suspensa.id,
      cliente_nome: "Cliente",
      cliente_email: "cliente@example.com",
      titulo: "Não deveria criar",
    });
    expect(error?.code).toBe("42501");
  });
});

describe("templates", () => {
  it("template próprio de B é invisível para A; globais são visíveis para todos", async () => {
    const { data: criado, error } = await b.client
      .from("templates")
      .insert({
        nicho: "design",
        titulo: "Meu template de logo",
        conteudo: { escopo: "x" },
        dono_id: b.id,
      })
      .select()
      .single();
    expect(error).toBeNull();

    const deA = await a.client.from("templates").select().eq("id", criado!.id);
    expect(deA.data).toEqual([]);

    const globais = await a.client.from("templates").select().is("dono_id", null);
    expect(globais.data!.length).toBeGreaterThanOrEqual(5);
  });

  it("prestador não cria template global", async () => {
    const { error } = await a.client
      .from("templates")
      .insert({ nicho: "reforma", titulo: "Global falso", conteudo: {} });
    expect(error?.code).toBe("42501");
  });
});
