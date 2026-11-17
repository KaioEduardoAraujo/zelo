"use server";

import { after } from "next/server";

import { processarAceite } from "@/lib/comprovante/servico";
import { serverEnv } from "@/lib/env.server";
import { enviarEmail } from "@/lib/email";
import { emailCodigo } from "@/lib/email/templates";
import { maskEmail } from "@/lib/format";
import { origemDaRequisicao } from "@/lib/http/origem";
import { textoConsentimento } from "@/lib/publico/consentimento";
import { dentroDoLimite } from "@/lib/publico/limites";
import { gerarCodigo, hashCodigo } from "@/lib/publico/otp";
import { carregarPropostaPublica, type PropostaPublica } from "@/lib/publico/queries";
import { codigoSchema, respostaSchema } from "@/lib/publico/schemas";
import { createServiceClient } from "@/lib/supabase/service";
import { flattenIssues } from "@/lib/validation/errors";

// Sem sessão: cada chamada valida o token de novo. O texto de consentimento é montado aqui,
// nunca recebido do navegador.

const MINUTOS_CODIGO = 10;
const MUITAS = "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
const INDISPONIVEL =
  "Esta proposta não aceita mais respostas. Atualize a página para ver a situação.";

const prestadorDoDocumento = (p: PropostaPublica) =>
  p.prestadorDocumento.empresa || p.prestadorDocumento.nome;

// Chamada pelo navegador: robôs de prévia de link não rodam JS e não contam como abertura.
export async function registrarAbertura(token: string): Promise<void> {
  const origem = await origemDaRequisicao();
  if (!(await dentroDoLimite("abrir", origem.ip, 60, 600))) return;

  const proposta = await carregarPropostaPublica(token);
  if (!proposta || proposta.estado !== "aberta") return;

  await createServiceClient().rpc("registrar_abertura", {
    p_proposta_id: proposta.id,
    p_ip: (origem.ip ?? null) as string,
    p_user_agent: (origem.userAgent ?? null) as string,
  });
}

export type EnviarCodigoResultado =
  | { ok: true; emailMascarado: string; expiraEm: string }
  | { ok: false; message: string; erros?: Record<string, string>; indisponivel?: boolean };

export async function enviarCodigo(
  token: string,
  entrada: unknown,
): Promise<EnviarCodigoResultado> {
  const origem = await origemDaRequisicao();
  if (!(await dentroDoLimite("codigo", origem.ip, 10, 3600))) return { ok: false, message: MUITAS };

  const dados = respostaSchema.safeParse(entrada);
  if (!dados.success) {
    return {
      ok: false,
      message: "Confira os campos destacados.",
      erros: flattenIssues(dados.error),
    };
  }

  const proposta = await carregarPropostaPublica(token);
  if (!proposta || proposta.estado !== "aberta" || !(proposta.conteudo || proposta.entrega)) {
    return { ok: false, message: INDISPONIVEL, indisponivel: true };
  }

  const codigo = gerarCodigo();
  const { data, error } = await createServiceClient()
    .rpc("registrar_otp", {
      p_proposta_id: proposta.id,
      p_email: proposta.cliente.email,
      p_codigo_hash: hashCodigo(serverEnv().HASH_PEPPER, proposta.id, dados.data.acao, codigo),
      p_acao: dados.data.acao,
      p_ip: (origem.ip ?? null) as string,
      p_user_agent: (origem.userAgent ?? null) as string,
    })
    .single();

  if (error || !data) {
    if (error?.message.includes("limite de códigos")) {
      return {
        ok: false,
        message: "Você já pediu 3 códigos na última hora. Espere um pouco e tente de novo.",
      };
    }
    if (error?.message.includes("indisponível"))
      return { ok: false, message: INDISPONIVEL, indisponivel: true };
    return { ok: false, message: "Não conseguimos gerar o código agora. Tente de novo." };
  }

  try {
    await enviarEmail({
      para: proposta.cliente.email,
      ...emailCodigo({
        codigo,
        acao: dados.data.acao,
        titulo: proposta.titulo,
        prestador: prestadorDoDocumento(proposta),
        minutos: MINUTOS_CODIGO,
        tipo: proposta.tipo,
      }),
    });
  } catch {
    // O erro do provedor pode conter o e-mail: não vai para a tela nem para o log.
    return {
      ok: false,
      message: "Não conseguimos enviar o e-mail agora. Tente de novo em instantes.",
    };
  }

  return {
    ok: true,
    emailMascarado: maskEmail(proposta.cliente.email),
    expiraEm: data.r_expira_em,
  };
}

export type ResponderResultado =
  | {
      ok: true;
      resultado: "aceito" | "recusado" | "ajuste";
      codigoComprovante: string;
      criadoEm: string;
      hash: string;
    }
  | {
      ok: false;
      message: string;
      erros?: Record<string, string>;
      novoCodigo?: boolean;
      indisponivel?: boolean;
    };

export async function responderProposta(
  token: string,
  entrada: unknown,
  codigo: unknown,
): Promise<ResponderResultado> {
  const origem = await origemDaRequisicao();
  if (!(await dentroDoLimite("responder", origem.ip, 30, 600)))
    return { ok: false, message: MUITAS };

  const dados = respostaSchema.safeParse(entrada);
  if (!dados.success) {
    return {
      ok: false,
      message: "Confira os campos destacados.",
      erros: flattenIssues(dados.error),
    };
  }
  const cod = codigoSchema.safeParse(codigo);
  if (!cod.success)
    return {
      ok: false,
      message: "O código tem 6 números.",
      erros: { codigo: "O código tem 6 números." },
    };

  const proposta = await carregarPropostaPublica(token);
  if (!proposta || proposta.estado !== "aberta" || !(proposta.conteudo || proposta.entrega)) {
    return { ok: false, message: INDISPONIVEL, indisponivel: true };
  }

  const { acao, nome, cpf, comentario } = dados.data;
  const { data, error } = await createServiceClient()
    .rpc("registrar_resposta", {
      p_proposta_id: proposta.id,
      p_codigo_hash: hashCodigo(serverEnv().HASH_PEPPER, proposta.id, acao, cod.data),
      p_resultado: acao,
      p_cliente_nome: nome,
      p_cliente_cpf: (acao === "aceito" ? cpf : null) as string,
      p_comentario: (comentario || null) as string,
      p_texto_consentimento: textoConsentimento(acao, {
        titulo: proposta.titulo,
        prestador: prestadorDoDocumento(proposta),
        valorCentavos: proposta.conteudo?.valor_total_centavos ?? null,
        tipo: proposta.tipo,
      }),
      p_ip: (origem.ip ?? null) as string,
      p_user_agent: (origem.userAgent ?? null) as string,
    })
    .single();

  if (error || !data)
    return { ok: false, message: "Não conseguimos registrar agora. Tente de novo." };

  switch (data.r_status) {
    case "ok":
      // PDF e e-mails depois da resposta: o aceite já vale e uma falha aqui não o desfaz.
      if (acao === "aceito" && data.r_aceite_id) {
        const aceiteId = data.r_aceite_id;
        after(() => processarAceite(aceiteId));
      }
      return {
        ok: true,
        resultado: acao,
        codigoComprovante: data.r_codigo_comprovante!,
        criadoEm: data.r_criado_em!,
        hash: data.r_hash_documento!,
      };
    case "codigo_incorreto": {
      const n = data.r_tentativas_restantes;
      return n > 0
        ? {
            ok: false,
            message: `Código incorreto. Você ainda tem ${n} ${n === 1 ? "tentativa" : "tentativas"}.`,
            erros: { codigo: "Código incorreto." },
          }
        : { ok: false, message: "Código incorreto. Peça um novo código.", novoCodigo: true };
    }
    case "expirado":
      return { ok: false, message: "Este código expirou. Peça um novo.", novoCodigo: true };
    case "bloqueado":
      return {
        ok: false,
        message: "Muitas tentativas com este código. Peça um novo.",
        novoCodigo: true,
      };
    case "sem_codigo":
      return { ok: false, message: "Peça um código para continuar.", novoCodigo: true };
    default:
      return { ok: false, message: INDISPONIVEL, indisponivel: true };
  }
}
