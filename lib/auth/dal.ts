import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { HOME_ADMIN, HOME_PRESTADOR } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/*
 * Data Access Layer de autenticação: a checagem de segurança DE VERDADE.
 * Toda página, layout e Server Action protegida chama uma destas funções.
 *
 * - getUser() consulta o servidor de Auth (não confia só no cookie), então uma sessão
 *   revogada ou um usuário apagado é detectado aqui.
 * - cache() do React: várias chamadas na mesma requisição fazem uma única consulta.
 */

export type Profile = Pick<
  Tables<"profiles">,
  "id" | "nome" | "email" | "telefone" | "empresa_nome" | "role" | "ativo"
>;

export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome, email, telefone, empresa_nome, role, ativo")
    .eq("id", user.id)
    .single();
  return profile ?? null;
});

/** Exige login e conta ativa. */
export async function requireUser(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!profile.ativo) redirect("/conta-suspensa");
  return profile;
}

/** Exige prestador ativo. Admin é mandado para a área dele. */
export async function requirePrestador(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "prestador") redirect(HOME_ADMIN);
  return profile;
}

/** Exige admin ativo. Prestador é mandado para o painel dele. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect(HOME_PRESTADOR);
  return profile;
}

export const homeFor = (profile: Pick<Profile, "role">) =>
  profile.role === "admin" ? HOME_ADMIN : HOME_PRESTADOR;
