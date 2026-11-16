"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePrestador } from "@/lib/auth/dal";
import type { FormState } from "@/lib/auth/actions";
import type { SaveResult } from "@/lib/autosave";
import { conteudoVazio, normalizarConteudo } from "@/lib/proposals/draft";
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
