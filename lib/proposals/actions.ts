"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePrestador } from "@/lib/auth/dal";
import type { FormState } from "@/lib/auth/actions";
import type { SaveResult } from "@/lib/autosave";
import { gerarToken, hashToken } from "@/lib/crypto/token";
import { origemDaRequisicao } from "@/lib/http/origem";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { conteudoVazio, normalizarConteudo } from "@/lib/proposals/draft";
import { prepararParaEnvio, valorDaVersao } from "@/lib/proposals/documento-servidor";
import type { ResumoEnvio } from "@/lib/proposals/envio";
import { normalizarEntrega, semSelo } from "@/lib/validation/entrega";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, phoneSchema } from "@/lib/validation/auth";
import { clienteSchema, conteudoRascunhoSchema } from "@/lib/validation/proposta";

// Usam a sessão do usuário: o RLS e os triggers decidem o que é permitido.

const text = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

const modeloSchema = z.union([z.literal("zero"), z.uuid()]);

export async function criarRascunho(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requirePrestador();

  const values = {
    modelo: text(formData, "modelo"),
    nome: text(formData, "nome"),
    email: text(formData, "email"),
    telefone: text(formData, "telefone"),
    titulo: text(formData, "titulo"),
  };

  const modelo = modeloSchema.safeParse(values.modelo);
  if (!modelo.success) return { message: "Escolha um modelo ou comece do zero.", values };

  const cliente = clienteSchema.safeParse(values);
  if (!cliente.success) return { errors: fieldErrors(cliente.error), values };

  const supabase = await createClient();

  let conteudo = conteudoVazio();
  if (modelo.data !== "zero") {
    const { data: tpl } = await supabase
      .from("templates")
      .select("conteudo")
      .eq("id", modelo.data)
      .eq("ativo", true)
      .maybeSingle();
    if (!tpl) return { message: "Não encontramos esse modelo. Escolha outro.", values };
    conteudo = normalizarConteudo(tpl.conteudo);
  }

  const falha: FormState = {
    message: "Não conseguimos criar a proposta agora. Seus dados continuam aqui, tente de novo.",
    values,
  };

  const { data: proposta, error } = await supabase
    .from("propostas")
    .insert({
      prestador_id: profile.id,
      cliente_nome: cliente.data.nome,
      cliente_email: cliente.data.email,
      cliente_telefone: cliente.data.telefone ?? null,
      titulo: cliente.data.titulo,
    })
    .select("id")
    .single();
  if (error || !proposta) return falha;

  const { error: erroVersao } = await supabase
    .from("proposta_versoes")
    .insert({ proposta_id: proposta.id, numero: 1, conteudo });
  if (erroVersao) {
    // Sem versão a proposta não serve: desfaz.
    await supabase.from("propostas").delete().eq("id", proposta.id);
    return falha;
  }

  revalidatePath("/propostas");
  redirect(`/propostas/${proposta.id}/editar?etapa=2`);
}

const salvarSchema = z.object({
  id: z.uuid(),
  cliente: z.object({
    nome: z.string().max(300),
    email: z.string().max(300),
    telefone: z.string().max(40),
    titulo: z.string().max(300),
  }),
  conteudo: conteudoRascunhoSchema,
});

export type SalvarRascunhoEntrada = z.input<typeof salvarSchema>;

// Grava o conteúdo sempre; dados do cliente só se já estiverem válidos. Sem revalidatePath.
export async function salvarRascunho(entrada: SalvarRascunhoEntrada): Promise<SaveResult> {
  await requirePrestador();

  const parsed = salvarSchema.safeParse(entrada);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Algum texto passou do tamanho permitido. Revise os campos longos.",
    };
  }
  const { id, cliente } = parsed.data;

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, status, versao_atual")
    .eq("id", id)
    .maybeSingle();
  if (!proposta) return { ok: false, message: "Não encontramos esta proposta." };
  if (proposta.status !== "rascunho") {
    return {
      ok: false,
      message: "Esta proposta já foi enviada. Crie uma nova versão para editar.",
    };
  }

  const { data: gravadas, error } = await supabase
    .from("proposta_versoes")
    .update({ conteudo: normalizarConteudo(parsed.data.conteudo) })
    .eq("proposta_id", id)
    .eq("numero", proposta.versao_atual)
    .is("enviada_em", null)
    .select("id");
  if (error || !gravadas?.length) return { ok: false };

  const campos: {
    cliente_nome?: string;
    cliente_email?: string;
    cliente_telefone?: string | null;
    titulo?: string;
  } = {};
  const nome = clienteSchema.shape.nome.safeParse(cliente.nome);
  if (nome.success) campos.cliente_nome = nome.data;
  const email = clienteSchema.shape.email.safeParse(cliente.email);
  if (email.success) campos.cliente_email = email.data;
  const titulo = clienteSchema.shape.titulo.safeParse(cliente.titulo);
  if (titulo.success) campos.titulo = titulo.data;
  const telefone = phoneSchema.safeParse(cliente.telefone);
  if (telefone.success) campos.cliente_telefone = telefone.data ?? null;

  // O trigger carimba atualizado_em, usado na listagem.
  const { error: erroProposta } = await supabase.from("propostas").update(campos).eq("id", id);
  if (erroProposta) return { ok: false };

  return { ok: true };
}

// A versão anterior fica intacta com o seu hash. O trigger recusa se a proposta já foi aceita.
export async function criarNovaVersao(propostaId: string): Promise<void> {
  await requirePrestador();
  if (!z.uuid().safeParse(propostaId).success) redirect("/propostas");

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, tipo, status, versao_atual")
    .eq("id", propostaId)
    .maybeSingle();
  if (!proposta) redirect("/propostas");

  if (proposta.status === "rascunho") redirect(`/propostas/${propostaId}/editar?etapa=2`);
  if (proposta.status === "aceita") redirect(`/propostas/${propostaId}?erro=aceita`);

  const { data: atual } = await supabase
    .from("proposta_versoes")
    .select("conteudo")
    .eq("proposta_id", propostaId)
    .eq("numero", proposta.versao_atual)
    .single();

  const { error } = await supabase.from("proposta_versoes").insert({
    proposta_id: propostaId,
    numero: proposta.versao_atual + 1, // o banco recalcula o número
    // As fotos perdem o selo: o próximo envio recalcula.
    conteudo: (proposta.tipo === "entrega"
      ? semSelo(normalizarEntrega(atual?.conteudo))
      : normalizarConteudo(atual?.conteudo)) as unknown as NonNullable<Json>,
  });
  if (error) redirect(`/propostas/${propostaId}?erro=nova-versao`);

  revalidatePath("/propostas");
  revalidatePath(`/propostas/${propostaId}`);
  redirect(`/propostas/${propostaId}/editar?etapa=2`);
}

export async function excluirRascunho(propostaId: string): Promise<void> {
  await requirePrestador();
  if (!z.uuid().safeParse(propostaId).success) redirect("/propostas");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("propostas")
    .delete()
    .eq("id", propostaId)
    .eq("status", "rascunho")
    .select("id");
  if (error || !data?.length) redirect(`/propostas/${propostaId}?erro=excluir`);

  revalidatePath("/propostas");
  redirect("/propostas?excluida=1");
}

export type EnvioResultado =
  | { ok: true; resumo: ResumoEnvio }
  | { ok: false; message: string; erros?: Record<string, string> };

const FALHA_ENVIO = "Não conseguimos enviar agora. Seus dados continuam aqui, tente de novo.";

function montarLink(token: string) {
  return `${publicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/p/${token}`;
}

// Relê o rascunho do banco e valida tudo de novo. O token só existe em memória: o banco recebe
// o HMAC dele.
export async function enviarProposta(propostaId: string): Promise<EnvioResultado> {
  const profile = await requirePrestador();
  if (!z.uuid().safeParse(propostaId).success)
    return { ok: false, message: "Não encontramos esta proposta." };

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select(
      "id, tipo, proposta_pai_id, titulo, cliente_nome, cliente_email, cliente_telefone, status, versao_atual",
    )
    .eq("id", propostaId)
    .maybeSingle();
  if (!proposta) return { ok: false, message: "Não encontramos esta proposta." };
  if (proposta.status !== "rascunho") {
    return {
      ok: false,
      message: "Esta proposta já foi enviada. Para mudar algo, crie uma nova versão.",
    };
  }

  const { data: versao } = await supabase
    .from("proposta_versoes")
    .select("conteudo")
    .eq("proposta_id", propostaId)
    .eq("numero", proposta.versao_atual)
    .maybeSingle();
  if (!versao) return { ok: false, message: FALHA_ENVIO };

  const preparado = await prepararParaEnvio(supabase, profile, proposta, versao.conteudo);
  if (!preparado.ok) {
    return {
      ok: false,
      message: preparado.message ?? "Falta preencher alguns campos antes de enviar.",
      erros: preparado.erros,
    };
  }

  const token = gerarToken();
  const origem = await origemDaRequisicao();
  const { data, error } = await supabase
    .rpc("enviar_versao", {
      p_proposta_id: propostaId,
      p_documento: preparado.documento as unknown as Json,
      p_hash: preparado.hash,
      p_token_hash: hashToken(serverEnv().HASH_PEPPER, token),
      p_ip: origem.ip,
      p_user_agent: origem.userAgent,
    })
    .single();
  if (error || !data) {
    // O texto do erro do banco não vai para a tela.
    if (error?.message.includes("não está em rascunho")) {
      return {
        ok: false,
        message: "Esta proposta já foi enviada. Para mudar algo, crie uma nova versão.",
      };
    }
    return { ok: false, message: FALHA_ENVIO };
  }

  // Não chamar revalidatePath: ele re-renderiza /editar, que redireciona antes de o link aparecer.
  return {
    ok: true,
    resumo: {
      propostaId,
      versao: data.r_numero,
      hash: preparado.hash,
      link: montarLink(token),
      validadeEm: data.r_validade_em,
      tipo: proposta.tipo,
      titulo: preparado.documento.titulo,
      clienteNome: proposta.cliente_nome,
      clienteTelefone: proposta.cliente_telefone,
      prestadorNome: profile.empresa_nome || profile.nome,
      valorCentavos: preparado.valorCentavos,
    },
  };
}

// O banco só tem o hash do token: um link perdido não pode ser mostrado de novo, só substituído.
export async function gerarNovoLink(propostaId: string): Promise<EnvioResultado> {
  const profile = await requirePrestador();
  if (!z.uuid().safeParse(propostaId).success)
    return { ok: false, message: "Não encontramos esta proposta." };

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, tipo, titulo, cliente_nome, cliente_telefone, status, versao_atual")
    .eq("id", propostaId)
    .maybeSingle();
  if (!proposta) return { ok: false, message: "Não encontramos esta proposta." };

  const { data: versao } = await supabase
    .from("proposta_versoes")
    .select("numero, hash_sha256, conteudo")
    .eq("proposta_id", propostaId)
    .eq("numero", proposta.versao_atual)
    .maybeSingle();
  if (!versao?.hash_sha256) return { ok: false, message: "Esta proposta ainda não foi enviada." };

  const token = gerarToken();
  const origem = await origemDaRequisicao();
  const { data, error } = await supabase
    .rpc("regenerar_link", {
      p_proposta_id: propostaId,
      p_token_hash: hashToken(serverEnv().HASH_PEPPER, token),
      p_ip: origem.ip,
      p_user_agent: origem.userAgent,
    })
    .single();

  if (error || !data) {
    if (error?.message.includes("venceu")) {
      return {
        ok: false,
        message: "Esta proposta venceu. Crie uma nova versão para enviar de novo.",
      };
    }
    if (error?.message.includes("não aceita um novo link")) {
      return { ok: false, message: "Esta proposta não aceita mais um novo link." };
    }
    return { ok: false, message: "Não conseguimos gerar o link agora. Tente de novo." };
  }

  revalidatePath(`/propostas/${propostaId}`);

  return {
    ok: true,
    resumo: {
      propostaId,
      versao: data.r_numero,
      hash: versao.hash_sha256,
      link: montarLink(token),
      validadeEm: data.r_validade_em,
      tipo: proposta.tipo,
      titulo: proposta.titulo,
      clienteNome: proposta.cliente_nome,
      clienteTelefone: proposta.cliente_telefone,
      prestadorNome: profile.empresa_nome || profile.nome,
      valorCentavos: valorDaVersao(proposta.tipo, versao.conteudo),
    },
  };
}
