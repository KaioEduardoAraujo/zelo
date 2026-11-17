import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { HOME_ADMIN, HOME_PRESTADOR } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

// getUser() consulta o Auth (não confia só no cookie). cache() evita repetir a consulta na
// mesma requisição.

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

export async function requireUser(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!profile.ativo) redirect("/conta-suspensa");
  return profile;
}

export async function requirePrestador(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "prestador") redirect(HOME_ADMIN);
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect(HOME_PRESTADOR);
  return profile;
}

export const homeFor = (profile: Pick<Profile, "role">) =>
  profile.role === "admin" ? HOME_ADMIN : HOME_PRESTADOR;
