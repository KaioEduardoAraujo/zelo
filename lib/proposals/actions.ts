"use server";

import { isIP } from "node:net";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePrestador } from "@/lib/auth/dal";
import type { FormState } from "@/lib/auth/actions";
import type { SaveResult } from "@/lib/autosave";
import { gerarToken, hashToken } from "@/lib/crypto/token";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { conteudoVazio, normalizarConteudo } from "@/lib/proposals/draft";
import { prepararDocumento, type ResumoEnvio } from "@/lib/proposals/envio";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, phoneSchema } from "@/lib/validation/auth";
import { clienteSchema, conteudoRascunhoSchema } from "@/lib/validation/proposta";

/*
 * Server Actions das propostas (Fase 4).
 *
 * Todas usam o cliente do usuário logado: quem decide o que é permitido é o banco (RLS e
 * triggers). A validação aqui existe para devolver mensagens claras e para nunca gravar
 * conteúdo fora do formato — mas ela NÃO é a única barreira.
 */

const text = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

const modeloSchema = z.union([z.literal("zero"), z.uuid()]);

/** Etapa 1 do assistente: cria o rascunho (proposta + versão 1) e abre a etapa 2. */
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
    // Sem versão a proposta não serve para nada: desfaz, para não deixar um rascunho órfão.
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

/**
 * Autosave. Chamado a cada ~1,5 s de edição, por isso:
 *  - o conteúdo é gravado sempre (leniente: nunca recusa campo incompleto);
 *  - cada dado do cliente só é gravado se JÁ estiver válido (e-mail pela metade não entra);
 *  - não chama revalidatePath (não deve re-renderizar a tela a cada salvamento).
 */
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

  // Sempre atualiza a proposta: o trigger do banco carimba `atualizado_em`, que a listagem usa.
  const { error: erroProposta } = await supabase.from("propostas").update(campos).eq("id", id);
  if (erroProposta) return { ok: false };

  return { ok: true };
}

/**
 * Editar uma proposta já enviada: cria a versão N+1 (cópia da atual) como rascunho. A versão
 * anterior fica intacta no banco, com seu hash. O trigger recusa se a proposta já foi aceita
 * (nesse caso o caminho é um aditivo) ou se já existe uma versão em rascunho.
 */
export async function criarNovaVersao(propostaId: string): Promise<void> {
  await requirePrestador();
  if (!z.uuid().safeParse(propostaId).success) redirect("/propostas");

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, status, versao_atual")
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
    numero: proposta.versao_atual + 1, // o banco recalcula: este valor é só ilustrativo
    conteudo: normalizarConteudo(atual?.conteudo),
  });
  if (error) redirect(`/propostas/${propostaId}?erro=nova-versao`);

  revalidatePath("/propostas");
  revalidatePath(`/propostas/${propostaId}`);
  redirect(`/propostas/${propostaId}/editar?etapa=2`);
}

/** Exclui um rascunho que nunca foi enviado. Enviada nunca é excluída (o banco bloqueia). */
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

/* ------------------------------ Envio (Fase 5) ------------------------------ */

export type EnvioResultado =
  | { ok: true; resumo: ResumoEnvio }
  | { ok: false; message: string; erros?: Record<string, string> };

const FALHA_ENVIO = "Não conseguimos enviar agora. Seus dados continuam aqui, tente de novo.";

/** IP e dispositivo de quem está agindo, para a trilha de auditoria. Nunca vão para o console. */
async function origemDaRequisicao() {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: encaminhado && isIP(encaminhado) ? encaminhado : undefined,
    userAgent: h.get("user-agent")?.slice(0, 512) || undefined,
  };
}

/** O link da proposta. O token só existe aqui, na memória, e na resposta que o entrega ao prestador. */
function montarLink(token: string) {
  return `${publicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/p/${token}`;
}

/**
 * ENVIAR: trava a versão atual com o seu hash, gera o link e registra o evento (tudo de uma vez,
 * numa função do banco).
 *
 * O servidor NÃO usa o que o navegador tem em tela: relê o rascunho do banco e valida tudo de novo.
 * (O assistente salva antes de chamar esta ação.) O token é gerado aqui, na memória: o banco recebe
 * só o HMAC dele, então nem quem tiver acesso ao banco consegue reconstruir o link.
 */
export async function enviarProposta(propostaId: string): Promise<EnvioResultado> {
  const profile = await requirePrestador();
  if (!z.uuid().safeParse(propostaId).success)
    return { ok: false, message: "Não encontramos esta proposta." };

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, titulo, cliente_nome, cliente_email, cliente_telefone, status, versao_atual")
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

  const preparado = prepararDocumento({
    propostaId,
    versao: proposta.versao_atual,
    titulo: proposta.titulo,
    clienteNome: proposta.cliente_nome,
    clienteEmail: proposta.cliente_email,
    clienteTelefone: proposta.cliente_telefone,
    prestadorNome: profile.nome,
    prestadorEmpresa: profile.empresa_nome,
    conteudo: versao.conteudo,
  });
  if (!preparado.ok) {
    return {
      ok: false,
      message: "Falta preencher alguns campos antes de enviar.",
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
    // Mensagem fixa: o texto do erro do banco não vai para a tela.
    if (error?.message.includes("não está em rascunho")) {
      return {
        ok: false,
        message: "Esta proposta já foi enviada. Para mudar algo, crie uma nova versão.",
      };
    }
    return { ok: false, message: FALHA_ENVIO };
  }

  // ATENÇÃO: aqui NÃO se chama revalidatePath. Em uma Server Action isso faz o Next re-renderizar a
  // página ATUAL (/editar), que, vendo a proposta já enviada, redireciona para o detalhe e
  // desmonta a tela antes de ela mostrar o link, que só existe nesta resposta. Lista, painel e
  // detalhe não precisam: páginas dinâmicas buscam dados novos a cada visita.
  return {
    ok: true,
    resumo: {
      propostaId,
      versao: data.r_numero,
      hash: preparado.hash,
      link: montarLink(token),
      validadeEm: data.r_validade_em,
      titulo: preparado.documento.titulo,
      clienteNome: preparado.documento.cliente.nome,
      clienteTelefone: preparado.documento.cliente.telefone,
      prestadorNome: profile.empresa_nome || profile.nome,
      valorCentavos: preparado.documento.valor_total_centavos,
    },
  };
}

/**
 * NOVO LINK: o banco só guarda o hash do token, então o link já enviado não pode ser mostrado de
 * novo. Quem perdeu o link gera outro; o anterior deixa de funcionar na hora (decisão D18).
 * A validade NÃO é renovada: para isso é preciso uma nova versão.
 */
export async function gerarNovoLink(propostaId: string): Promise<EnvioResultado> {
  const profile = await requirePrestador();
  if (!z.uuid().safeParse(propostaId).success)
    return { ok: false, message: "Não encontramos esta proposta." };

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, titulo, cliente_nome, cliente_telefone, status, versao_atual")
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
      titulo: proposta.titulo,
      clienteNome: proposta.cliente_nome,
      clienteTelefone: proposta.cliente_telefone,
      prestadorNome: profile.empresa_nome || profile.nome,
      valorCentavos: normalizarConteudo(versao.conteudo).valor_total_centavos,
    },
  };
}
