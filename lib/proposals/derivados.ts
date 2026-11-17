"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePrestador } from "@/lib/auth/dal";
import type { SaveResult } from "@/lib/autosave";
import { conteudoVazio, normalizarConteudo } from "@/lib/proposals/draft";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  CHECKLIST_MAX,
  FOTOS_MAX,
  caminhoFotoValido,
  entregaVazia,
  normalizarEntrega,
} from "@/lib/validation/entrega";

const idSchema = z.uuid();
const TITULO_MAX = 140;

const titulo = (prefixo: string, original: string) =>
  `${prefixo}: ${original}`.slice(0, TITULO_MAX).trim();

async function lerPai(paiId: string) {
  const supabase = await createClient();
  const { data: pai } = await supabase
    .from("propostas")
    .select("id, tipo, status, titulo, cliente_nome, cliente_email, cliente_telefone, versao_atual")
    .eq("id", paiId)
    .maybeSingle();
  if (!pai || pai.tipo !== "proposta" || pai.status !== "aceita") return null;
  const { data: versao } = await supabase
    .from("proposta_versoes")
    .select("conteudo")
    .eq("proposta_id", paiId)
    .eq("numero", pai.versao_atual)
    .maybeSingle();
  return { supabase, pai, conteudo: normalizarConteudo(versao?.conteudo) };
}

export async function criarAditivo(paiId: string): Promise<void> {
  const profile = await requirePrestador();
  if (!idSchema.safeParse(paiId).success) redirect("/propostas");

  const origem = await lerPai(paiId);
  if (!origem) redirect(`/propostas/${paiId}?erro=aditivo`);
  const { supabase, pai, conteudo: base } = origem;

  const { data: novo, error } = await supabase
    .from("propostas")
    .insert({
      prestador_id: profile.id,
      tipo: "aditivo",
      proposta_pai_id: pai.id,
      cliente_nome: pai.cliente_nome,
      cliente_email: pai.cliente_email,
      cliente_telefone: pai.cliente_telefone,
      titulo: titulo("Aditivo", pai.titulo),
    })
    .select("id")
    .single();
  if (error || !novo) redirect(`/propostas/${paiId}?erro=aditivo`);

  const conteudo = {
    ...conteudoVazio(),
    pagamento: base.pagamento,
    garantia: base.garantia,
    validade_dias: base.validade_dias,
  };
  const { error: erroVersao } = await supabase
    .from("proposta_versoes")
    .insert({ proposta_id: novo.id, numero: 1, conteudo });
  if (erroVersao) {
    await supabase.from("propostas").delete().eq("id", novo.id);
    redirect(`/propostas/${paiId}?erro=aditivo`);
  }

  revalidatePath("/propostas");
  revalidatePath(`/propostas/${paiId}`);
  redirect(`/propostas/${novo.id}/editar?etapa=2`);
}

export async function criarEntrega(paiId: string): Promise<void> {
  const profile = await requirePrestador();
  if (!idSchema.safeParse(paiId).success) redirect("/propostas");

  const origem = await lerPai(paiId);
  if (!origem) redirect(`/propostas/${paiId}?erro=entrega`);
  const { supabase, pai, conteudo: base } = origem;

  const { data: novo, error } = await supabase
    .from("propostas")
    .insert({
      prestador_id: profile.id,
      tipo: "entrega",
      proposta_pai_id: pai.id,
      cliente_nome: pai.cliente_nome,
      cliente_email: pai.cliente_email,
      cliente_telefone: pai.cliente_telefone,
      titulo: titulo("Entrega", pai.titulo),
    })
    .select("id")
    .single();
  if (error || !novo) redirect(`/propostas/${paiId}?erro=entrega`);

  const conteudo = {
    ...entregaVazia(),
    checklist: base.itens
      .map((i) => ({ texto: i.descricao.slice(0, 200), feito: false }))
      .filter((i) => i.texto !== "")
      .slice(0, CHECKLIST_MAX),
  };
  const { error: erroVersao } = await supabase.from("proposta_versoes").insert({
    proposta_id: novo.id,
    numero: 1,
    conteudo: conteudo as unknown as NonNullable<Json>,
  });
  if (erroVersao) {
    await supabase.from("propostas").delete().eq("id", novo.id);
    redirect(`/propostas/${paiId}?erro=entrega`);
  }

  revalidatePath("/propostas");
  revalidatePath(`/propostas/${paiId}`);
  redirect(`/propostas/${novo.id}/editar`);
}

const salvarEntregaSchema = z.object({
  id: z.uuid(),
  conteudo: z.object({
    resumo: z.string().max(4000),
    checklist: z
      .array(z.object({ texto: z.string().max(200), feito: z.boolean() }))
      .max(CHECKLIST_MAX),
    fotos: z
      .array(z.object({ path: z.string().max(200), nome: z.string().max(120) }))
      .max(FOTOS_MAX),
    observacoes: z.string().max(2000).optional(),
    validade_dias: z.number().int().min(1).max(90),
  }),
});

export type SalvarEntregaEntrada = z.input<typeof salvarEntregaSchema>;

// As fotos só entram se o caminho for da pasta deste prestador e desta entrega.
export async function salvarEntrega(entrada: SalvarEntregaEntrada): Promise<SaveResult> {
  const profile = await requirePrestador();

  const parsed = salvarEntregaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, message: "Algum texto passou do tamanho permitido. Revise os campos." };
  }
  const { id, conteudo } = parsed.data;
  if (!conteudo.fotos.every((f) => caminhoFotoValido(f.path, profile.id, id))) {
    return { ok: false, message: "Uma das fotos é inválida. Remova e anexe de novo." };
  }

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, tipo, status, versao_atual, titulo")
    .eq("id", id)
    .maybeSingle();
  if (!proposta || proposta.tipo !== "entrega") {
    return { ok: false, message: "Não encontramos esta entrega." };
  }
  if (proposta.status !== "rascunho") {
    return { ok: false, message: "Esta entrega já foi enviada. Crie uma nova versão para editar." };
  }

  const { data: gravadas, error } = await supabase
    .from("proposta_versoes")
    .update({ conteudo: normalizarEntrega(conteudo) as unknown as NonNullable<Json> })
    .eq("proposta_id", id)
    .eq("numero", proposta.versao_atual)
    .is("enviada_em", null)
    .select("id");
  if (error || !gravadas?.length) return { ok: false };

  // Regrava o título só para o trigger carimbar atualizado_em.
  const { error: erroProposta } = await supabase
    .from("propostas")
    .update({ titulo: proposta.titulo })
    .eq("id", id);
  if (erroProposta) return { ok: false };

  return { ok: true };
}
