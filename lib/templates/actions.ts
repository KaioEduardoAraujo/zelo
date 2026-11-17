"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePrestador } from "@/lib/auth/dal";
import { NICHO_ORDER } from "@/lib/nichos";
import { normalizarConteudo } from "@/lib/proposals/draft";
import { createClient } from "@/lib/supabase/server";
import { flattenIssues } from "@/lib/validation/errors";
import { conteudoPropostaSchema, conteudoRascunhoSchema } from "@/lib/validation/proposta";

export type ModeloResultado =
  { ok: true } | { ok: false; errors?: Record<string, string>; message?: string };

const idSchema = z.uuid();

export async function duplicarModelo(modeloId: string): Promise<void> {
  const profile = await requirePrestador();
  if (!idSchema.safeParse(modeloId).success) redirect("/templates");

  const supabase = await createClient();
  const { data: origem } = await supabase
    .from("templates")
    .select("nicho, titulo, conteudo")
    .eq("id", modeloId)
    .eq("ativo", true)
    .maybeSingle();
  if (!origem) redirect("/templates");

  const { data: copia, error } = await supabase
    .from("templates")
    .insert({
      nicho: origem.nicho,
      titulo: `${origem.titulo} (personalizado)`.slice(0, 120),
      conteudo: normalizarConteudo(origem.conteudo),
      dono_id: profile.id,
    })
    .select("id")
    .single();
  if (error || !copia) redirect("/templates?erro=duplicar");

  revalidatePath("/templates");
  redirect(`/templates/${copia.id}/editar`);
}

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

export type SalvarModeloEntrada = z.input<typeof salvarSchema>;

export async function salvarModelo(entrada: SalvarModeloEntrada): Promise<ModeloResultado> {
  const profile = await requirePrestador();

  const parsed = salvarSchema.safeParse(entrada);
  if (!parsed.success) {
    return {
      ok: false,
      errors: flattenIssues(parsed.error),
      message: "Confira os campos destacados.",
    };
  }

  const conteudo = normalizarConteudo(parsed.data.conteudo);
  const estrito = conteudoPropostaSchema.safeParse(conteudo);
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
    .eq("dono_id", profile.id)
    .select("id");

  if (error || !data?.length) {
    return {
      ok: false,
      message: "Não conseguimos salvar agora. Seus dados continuam aqui, tente de novo.",
    };
  }
  revalidatePath("/templates");
  return { ok: true };
}

export async function excluirModelo(modeloId: string): Promise<void> {
  const profile = await requirePrestador();
  if (!idSchema.safeParse(modeloId).success) redirect("/templates");

  const supabase = await createClient();
  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", modeloId)
    .eq("dono_id", profile.id);
  if (error) redirect("/templates?erro=excluir");

  revalidatePath("/templates");
  redirect("/templates?excluido=1");
}
