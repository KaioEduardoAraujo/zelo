import { beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  criarAceita,
  criarEnviada,
  criarRascunho,
  criarUsuario,
  hashAleatorio,
  serviceClient,
  type Usuario,
} from "./helpers";

/*
 * Fase 6: funções usadas pela página pública do cliente. Só a service_role (o servidor) as
 * executa; os triggers continuam valendo para ela.
 */
let a: Usuario;
const svc = () => serviceClient();

beforeAll(async () => {
  a = await criarUsuario("Andrade Reformas");
});

const UA = "Mozilla/5.0 (Linux; Android 15) Chrome/131";

function otp(
  propostaId: string,
  codigoHash = hashAleatorio(),
  acao: "aceito" | "recusado" | "ajuste" = "aceito",
) {
  return svc()
    .rpc("registrar_otp", {
      p_proposta_id: propostaId,
      p_email: "cliente@example.com",
      p_codigo_hash: codigoHash,
      p_acao: acao,
      p_ip: "177.92.40.18",
      p_user_agent: UA,
    })
    .single();
}

function responder(
  propostaId: string,
  codigoHash: string,
  over: {
    resultado?: "aceito" | "recusado" | "ajuste";
    cpf?: string | null;
    comentario?: string | null;
  } = {},
) {
  return svc()
    .rpc("registrar_resposta", {
      p_proposta_id: propostaId,
      p_codigo_hash: codigoHash,
      p_resultado: over.resultado ?? "aceito",
      p_cliente_nome: "Mariana Costa",
      p_cliente_cpf: (over.cpf === undefined ? "52998224725" : over.cpf) as string,
      p_comentario: (over.comentario ?? null) as string,
      p_texto_consentimento: "Li a proposta e aceito os termos acima.",
      p_ip: "177.92.40.18",
      p_user_agent: UA,
    })
    .single();
}

async function eventos(propostaId: string) {
  const { data } = await svc()
    .from("auditoria_eventos")
    .select("tipo, metadados, ip")
    .eq("proposta_id", propostaId)
    .order("criado_em");
  return data ?? [];
}

describe("consumir_limite", () => {
  it("conta por chave e recusa ao passar do limite", async () => {
    const chave = `teste:${hashAleatorio()}`;
    const r = [];
    for (let i = 0; i < 4; i++) {
      r.push(
        (
          await svc().rpc("consumir_limite", {
            p_chave: chave,
            p_limite: 3,
            p_janela_segundos: 600,
          })
        ).data,
      );
    }
    expect(r).toEqual([true, true, true, false]);

    const outra = await svc().rpc("consumir_limite", {
      p_chave: `${chave}:outra`,
      p_limite: 3,
      p_janela_segundos: 600,
    });
    expect(outra.data).toBe(true);
  });
});

describe("só o servidor executa as funções da página pública", () => {
  it("nem visitante anônimo nem usuário logado", async () => {
    const enviada = await criarEnviada(a);
    for (const cliente of [anonClient(), a.client]) {
      const chamadas = [
        cliente.rpc("consumir_limite", { p_chave: "x", p_limite: 1, p_janela_segundos: 60 }),
        cliente.rpc("registrar_abertura", {
          p_proposta_id: enviada.propostaId,
          p_ip: null as never,
          p_user_agent: UA,
        }),
        cliente.rpc("registrar_otp", {
          p_proposta_id: enviada.propostaId,
          p_email: "x@example.com",
          p_codigo_hash: hashAleatorio(),
          p_acao: "aceito",
          p_ip: null as never,
          p_user_agent: UA,
        }),
        cliente.rpc("registrar_resposta", {
          p_proposta_id: enviada.propostaId,
          p_codigo_hash: hashAleatorio(),
          p_resultado: "aceito",
          p_cliente_nome: "X",
          p_cliente_cpf: "52998224725",
          p_comentario: null as never,
          p_texto_consentimento: "x",
          p_ip: null as never,
          p_user_agent: UA,
        }),
      ];
      for (const r of await Promise.all(chamadas)) expect(r.error).not.toBeNull();
    }
    const { data } = await svc()
      .from("propostas")
      .select("status")
      .eq("id", enviada.propostaId)
      .single();
    expect(data?.status).toBe("enviada");
  });

  it("a tabela de limites não é legível pela API", async () => {
    const { error } = await a.client.from("limites_taxa").select();
    expect(error).not.toBeNull();
  });
});

describe("registrar_abertura", () => {
  it("marca como visualizada e registra uma abertura por dispositivo a cada 10 minutos", async () => {
    const e = await criarEnviada(a);
    for (let i = 0; i < 3; i++) {
      await svc().rpc("registrar_abertura", {
        p_proposta_id: e.propostaId,
        p_ip: "177.92.40.18",
        p_user_agent: UA,
      });
    }
    await svc().rpc("registrar_abertura", {
      p_proposta_id: e.propostaId,
      p_ip: "177.92.40.18",
      p_user_agent: "Outro navegador",
    });

    const { data } = await svc().from("propostas").select("status").eq("id", e.propostaId).single();
    expect(data?.status).toBe("visualizada");
    expect((await eventos(e.propostaId)).filter((x) => x.tipo === "aberta")).toHaveLength(2);
  });

  it("não mexe em proposta aceita, vencida ou em rascunho", async () => {
    const aceita = await criarAceita(a);
    const vencida = await criarEnviada(a);
    await svc()
      .from("propostas")
      .update({ validade_em: new Date(Date.now() - 864e5).toISOString() })
      .eq("id", vencida.propostaId);
    const { proposta: rascunho } = await criarRascunho(a);

    for (const id of [aceita.propostaId, vencida.propostaId, rascunho.id]) {
      const { error } = await svc().rpc("registrar_abertura", {
        p_proposta_id: id,
        p_ip: "177.92.40.18",
        p_user_agent: UA,
      });
      expect(error).toBeNull();
      expect((await eventos(id)).filter((x) => x.tipo === "aberta")).toHaveLength(0);
    }
    const { data } = await svc()
      .from("propostas")
      .select("status")
      .eq("id", vencida.propostaId)
      .single();
    expect(data?.status).toBe("enviada");
  });
});

describe("registrar_otp", () => {
  it("guarda o código por 10 minutos, registra o evento sem o e-mail e limita a 3 por hora", async () => {
    const e = await criarEnviada(a);
    const primeiro = await otp(e.propostaId);
    expect(primeiro.error).toBeNull();
    const minutos = (new Date(primeiro.data!.r_expira_em).getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(9.5);
    expect(minutos).toBeLessThanOrEqual(10);
    expect(primeiro.data?.r_restantes).toBe(2);

    expect((await otp(e.propostaId)).data?.r_restantes).toBe(1);
    expect((await otp(e.propostaId)).data?.r_restantes).toBe(0);
    const quarto = await otp(e.propostaId);
    expect(quarto.error?.message).toMatch(/limite de códigos/);

    const ev = (await eventos(e.propostaId)).filter((x) => x.tipo === "otp_enviado");
    expect(ev).toHaveLength(3);
    expect(ev[0].metadados).toEqual({ acao: "aceito" });
    expect(JSON.stringify(ev)).not.toContain("cliente@example.com");
  });

  it("recusa proposta que não aceita resposta e hash fora do formato", async () => {
    const aceita = await criarAceita(a);
    expect((await otp(aceita.propostaId)).error?.message).toMatch(/indisponível/);
    const { proposta } = await criarRascunho(a);
    expect((await otp(proposta.id)).error?.message).toMatch(/indisponível/);
    const e = await criarEnviada(a);
    expect((await otp(e.propostaId, "abc")).error?.message).toMatch(/formato inválido/);
  });
});

describe("registrar_resposta", () => {
  it("sem código pedido não há resposta", async () => {
    const e = await criarEnviada(a);
    const { data } = await responder(e.propostaId, hashAleatorio());
    expect(data?.r_status).toBe("sem_codigo");
  });

  it("código errado conta a tentativa (mesmo sem lançar erro) e bloqueia na quinta", async () => {
    const e = await criarEnviada(a);
    const certo = hashAleatorio();
    await otp(e.propostaId, certo);

    const restantes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const { data } = await responder(e.propostaId, hashAleatorio());
      expect(data?.r_status).toBe("codigo_incorreto");
      restantes.push(data!.r_tentativas_restantes);
    }
    expect(restantes).toEqual([4, 3, 2, 1, 0]);

    // Mesmo o código certo não vale mais: é preciso pedir outro
    const { data } = await responder(e.propostaId, certo);
    expect(data?.r_status).toBe("bloqueado");

    const { data: linha } = await svc()
      .from("otp_codigos")
      .select("tentativas, usado_em")
      .eq("proposta_id", e.propostaId)
      .single();
    expect(linha).toEqual({ tentativas: 5, usado_em: null });
    expect((await eventos(e.propostaId)).filter((x) => x.tipo === "otp_falhou")).toHaveLength(5);
  });

  it("código vencido não vale", async () => {
    const e = await criarEnviada(a);
    const certo = hashAleatorio();
    await otp(e.propostaId, certo);
    await svc()
      .from("otp_codigos")
      .update({ expira_em: new Date(Date.now() - 1000).toISOString() })
      .eq("proposta_id", e.propostaId);
    const { data } = await responder(e.propostaId, certo);
    expect(data?.r_status).toBe("expirado");
  });

  it("só o código mais recente vale", async () => {
    const e = await criarEnviada(a);
    const antigo = hashAleatorio();
    await otp(e.propostaId, antigo);
    await otp(e.propostaId, hashAleatorio());
    const { data } = await responder(e.propostaId, antigo);
    expect(data?.r_status).toBe("codigo_incorreto");
  });

  it("código certo: grava o aceite com o hash da versão, muda o status e registra a trilha; uso único", async () => {
    const e = await criarEnviada(a);
    const certo = hashAleatorio();
    await svc().rpc("registrar_abertura", {
      p_proposta_id: e.propostaId,
      p_ip: "177.92.40.18",
      p_user_agent: UA,
    });
    await otp(e.propostaId, certo);
    await responder(e.propostaId, hashAleatorio()); // uma tentativa errada antes

    const { data, error } = await responder(e.propostaId, certo);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      r_status: "ok",
      r_tentativas_restantes: 4,
      r_hash_documento: e.hash,
    });
    expect(data?.r_codigo_comprovante).toMatch(/^ZL-[2-9A-Z]{4}-[2-9A-Z]{4}$/);

    const { data: aceite } = await svc()
      .from("aceites")
      .select("*")
      .eq("id", data!.r_aceite_id!)
      .single();
    expect(aceite).toMatchObject({
      resultado: "aceito",
      cliente_nome: "Mariana Costa",
      cliente_cpf: "52998224725",
      hash_documento: e.hash,
      ip: "177.92.40.18",
      codigo_comprovante: data!.r_codigo_comprovante,
      pdf_path: `${a.id}/${data!.r_aceite_id}.pdf`,
    });

    const { data: p } = await svc()
      .from("propostas")
      .select("status")
      .eq("id", e.propostaId)
      .single();
    expect(p?.status).toBe("aceita");
    const { data: codigo } = await svc()
      .from("otp_codigos")
      .select("usado_em")
      .eq("proposta_id", e.propostaId)
      .single();
    expect(codigo?.usado_em).not.toBeNull();

    expect((await eventos(e.propostaId)).map((x) => x.tipo)).toEqual([
      "aberta",
      "otp_enviado",
      "otp_falhou",
      "otp_verificado",
      "aceita",
    ]);

    // O mesmo código de novo: a proposta já não aceita resposta
    const { data: denovo } = await responder(e.propostaId, certo);
    expect(denovo?.r_status).toBe("indisponivel");
    const { data: aceites } = await svc().from("aceites").select("id").eq("versao_id", e.versaoId);
    expect(aceites).toHaveLength(1);
  });

  it("recusa e pedido de ajuste mudam o status correspondente", async () => {
    const recusa = await criarEnviada(a);
    const c1 = hashAleatorio();
    await otp(recusa.propostaId, c1, "recusado");
    expect(
      (await responder(recusa.propostaId, c1, { resultado: "recusado", cpf: null })).data?.r_status,
    ).toBe("ok");

    const ajuste = await criarEnviada(a);
    const c2 = hashAleatorio();
    await otp(ajuste.propostaId, c2, "ajuste");
    expect(
      (
        await responder(ajuste.propostaId, c2, {
          resultado: "ajuste",
          cpf: null,
          comentario: "Pode incluir a película?",
        })
      ).data?.r_status,
    ).toBe("ok");

    const { data } = await svc()
      .from("propostas")
      .select("id, status")
      .in("id", [recusa.propostaId, ajuste.propostaId]);
    expect(Object.fromEntries(data!.map((x) => [x.id, x.status]))).toEqual({
      [recusa.propostaId]: "recusada",
      [ajuste.propostaId]: "ajuste_solicitado",
    });
    const { data: pdf } = await svc()
      .from("aceites")
      .select("pdf_path")
      .eq("versao_id", recusa.versaoId)
      .single();
    expect(pdf?.pdf_path).toBeNull(); // só aceite gera comprovante
  });

  it("resposta inválida é recusada por inteiro: o código NÃO fica consumido", async () => {
    const e = await criarEnviada(a);
    const certo = hashAleatorio();
    await otp(e.propostaId, certo);

    // Aceite sem CPF viola a regra do banco: a transação inteira é desfeita
    const { error } = await responder(e.propostaId, certo, { cpf: null });
    expect(error).not.toBeNull();

    const { data: codigo } = await svc()
      .from("otp_codigos")
      .select("usado_em")
      .eq("proposta_id", e.propostaId)
      .single();
    expect(codigo?.usado_em).toBeNull();
    const { data: p } = await svc()
      .from("propostas")
      .select("status")
      .eq("id", e.propostaId)
      .single();
    expect(p?.status).toBe("enviada");
    expect((await eventos(e.propostaId)).map((x) => x.tipo)).toEqual(["otp_enviado"]);

    // E dá para concluir em seguida, com os dados certos
    expect((await responder(e.propostaId, certo)).data?.r_status).toBe("ok");
  });

  it("proposta vencida não aceita resposta", async () => {
    const e = await criarEnviada(a);
    const certo = hashAleatorio();
    await otp(e.propostaId, certo);
    await svc()
      .from("propostas")
      .update({ validade_em: new Date(Date.now() - 1000).toISOString() })
      .eq("id", e.propostaId);
    expect((await responder(e.propostaId, certo)).data?.r_status).toBe("indisponivel");
  });
});
