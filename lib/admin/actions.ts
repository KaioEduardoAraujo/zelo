"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/dal";
import { NICHO_ORDER } from "@/lib/nichos";
import { conteudoVazio, normalizarConteudo } from "@/lib/proposals/draft";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { flattenIssues } from "@/lib/validation/errors";
import { conteudoPropostaSchema, conteudoRascunhoSchema } from "@/lib/validation/proposta";

/*
 * Ações do administrador. Toda ação confere o papel NO SERVIDOR (requireAdmin) e o banco repete
 * a regra (RLS e triggers): o admin só muda `ativo` de OUTROS perfis e nunca toca em aceites.
 */

const idSchema = z.uuid();

// ~100 anos. O Auth do Supabase não tem "banido para sempre": é uma duração.
const BAN_LONGO = "876000h";

/**
 * Suspender / reativar um prestador (decisão D28):
 *  1. `profiles.ativo` muda pelo cliente do admin (o trigger só deixa o admin mexer no `ativo`
 *     de OUTRA pessoa, e só em perfis; RLS da conta suspensa bloqueia criar/alterar propostas);
 *  2. o usuário é banido no Supabase Auth: o token de renovação para de funcionar.
 * Links já enviados continuam válidos: a página do cliente não depende da conta do prestador.
 * Se o passo 2 falhar, o passo 1 é desfeito (não fica meio suspenso).
 */
export async function alterarSituacaoPrestador(
  prestadorId: string,
  ativar: boolean,
): Promise<void> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(prestadorId).success || prestadorId === admin.id) {
    redirect("/admin?erro=situacao");
  }

  const supabase = await createClient();
  const { data: alvo } = await supabase
    .from("profiles")
    .select("id, role, ativo")
    .eq("id", prestadorId)
    .maybeSingle();
  if (!alvo || alvo.role !== "prestador") redirect("/admin?erro=situacao");
  if (alvo.ativo === ativar) redirect(`/admin?ok=${ativar ? "reativado" : "suspenso"}`);

  const { data: atualizado, error } = await supabase
    .from("profiles")
    .update({ ativo: ativar })
    .eq("id", prestadorId)
    .select("id");
  if (error || !atualizado?.length) redirect("/admin?erro=situacao");

  const { error: erroAuth } = await createServiceClient().auth.admin.updateUserById(prestadorId, {
    ban_duration: ativar ? "none" : BAN_LONGO,
  });
  if (erroAuth) {
    await supabase.from("profiles").update({ ativo: !ativar }).eq("id", prestadorId);
    redirect("/admin?erro=situacao");
  }

  revalidatePath("/admin");
  redirect(`/admin?ok=${ativar ? "reativado" : "suspenso"}`);
}

/* ------------------------- Templates globais ------------------------- */

export type ModeloGlobalResultado =
  { ok: true } | { ok: false; errors?: Record<string, string>; message?: string };

const salvarSchema = z.object({
  id: z.uuid(),
  titulo: z
    .string()
    .trim()
    .min(3, "Dê um nome ao modelo (pelo menos 3 letras).")
    .max(120, "Use no máximo 120 caracteres."),
  nicho: z.enum(NICHO_ORDER as [string, ...string[]]),
  conteudo: conteudoRascunhoSchema,
});

export type SalvarModeloGlobalEntrada = z.input<typeof salvarSchema>;

/** Um modelo é sempre um conteúdo COMPLETO (formato estrito), igual ao dos modelos dos prestadores. */
export async function salvarModeloGlobal(
  entrada: SalvarModeloGlobalEntrada,
): Promise<ModeloGlobalResultado> {
  await requireAdmin();
  const parsed = salvarSchema.safeParse(entrada);
  if (!parsed.success) {
    return {
      ok: false,
      errors: flattenIssues(parsed.error),
      message: "Confira os campos destacados.",
    };
  }
  const estrito = conteudoPropostaSchema.safeParse(normalizarConteudo(parsed.data.conteudo));
  if (!estrito.success) {
    return {
      ok: false,
      errors: flattenIssues(estrito.error),
      message: "Confira os campos destacados.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .update({
      titulo: parsed.data.titulo,
      nicho: parsed.data.nicho as (typeof NICHO_ORDER)[number],
      conteudo: estrito.data,
    })
    .eq("id", parsed.data.id)
    .is("dono_id", null) // só globais; o RLS repete a regra
    .select("id");
  if (error || !data?.length) {
    return {
      ok: false,
      message: "Não conseguimos salvar agora. Seus dados continuam aqui, tente de novo.",
    };
  }
  revalidatePath("/admin/templates");
  return { ok: true };
}

/** Novo modelo global: nasce INATIVO (ninguém o vê) até ser preenchido e ativado. */
export async function criarModeloGlobal(): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .insert({
      nicho: "reforma",
      titulo: "Novo modelo",
      conteudo: conteudoVazio(),
      dono_id: null,
      ativo: false,
    })
    .select("id")
    .single();
  if (error || !data) redirect("/admin/templates?erro=criar");
  revalidatePath("/admin/templates");
  redirect(`/admin/templates/${data.id}/editar`);
}

export async function alternarModeloGlobal(id: string, ativo: boolean): Promise<void> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) redirect("/admin/templates");
  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("templates")
    .select("conteudo")
    .eq("id", id)
    .is("dono_id", null)
    .maybeSingle();
  // Só vai para o ar um modelo completo (o que um prestador vai usar para começar uma proposta).
  if (ativo && !conteudoPropostaSchema.safeParse(normalizarConteudo(atual?.conteudo)).success) {
    redirect("/admin/templates?erro=incompleto");
  }
  const { error } = await supabase
    .from("templates")
    .update({ ativo })
    .eq("id", id)
    .is("dono_id", null);
  if (error) redirect("/admin/templates?erro=alternar");
  revalidatePath("/admin/templates");
  redirect("/admin/templates");
}

export async function excluirModeloGlobal(id: string): Promise<void> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) redirect("/admin/templates");
  const supabase = await createClient();
  // Propostas criadas a partir de um modelo guardam uma CÓPIA do conteúdo: excluir não as afeta.
  const { error } = await supabase.from("templates").delete().eq("id", id).is("dono_id", null);
  if (error) redirect("/admin/templates?erro=excluir");
  revalidatePath("/admin/templates");
  redirect("/admin/templates?excluido=1");
}
