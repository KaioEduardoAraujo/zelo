import "server-only";

import { requireAdmin } from "@/lib/auth/dal";
import type { Nicho } from "@/lib/nichos";
import { normalizarConteudo } from "@/lib/proposals/draft";
import { createClient } from "@/lib/supabase/server";
import type { ConteudoRascunho } from "@/lib/validation/proposta";

/*
 * Leituras do painel do administrador. Usam o cliente do USUÁRIO (admin): quem decide o que ele
 * vê é o banco. O admin NÃO lê propostas nem aceites de ninguém; só as contagens, pela função
 * `admin_resumo_prestadores` (que exige admin) e os templates globais (RLS).
 */

export type PrestadorResumo = {
  id: string;
  nome: string;
  email: string;
  empresa: string | null;
  ativo: boolean;
  criadoEm: string;
  propostas: number;
  aceites: number;
};

export type FiltroPrestadores = { q: string; situacao: "todos" | "ativos" | "suspensos" };

export function lerFiltroPrestadores(
  sp: Record<string, string | string[] | undefined>,
): FiltroPrestadores {
  const bruto = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  // Só letras, números, espaço e os caracteres comuns de nome/e-mail: a busca é feita em memória.
  const q = bruto(sp.q)
    .replace(/[^\p{L}\p{N}\s@.\-_]/gu, "")
    .trim()
    .slice(0, 80);
  const s = bruto(sp.situacao);
  return { q, situacao: s === "ativos" || s === "suspensos" ? s : "todos" };
}

export type PainelAdmin = {
  prestadores: PrestadorResumo[];
  /** Contagens gerais, sobre TODOS os prestadores (não só os filtrados). */
  totais: {
    prestadores: number;
    ativos: number;
    suspensos: number;
    propostas: number;
    aceites: number;
  };
};

export async function carregarPainelAdmin(f: FiltroPrestadores): Promise<PainelAdmin> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_resumo_prestadores");
  if (error) throw new Error("Falha ao listar prestadores");

  const todos: PrestadorResumo[] = (data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    empresa: p.empresa_nome,
    ativo: p.ativo,
    criadoEm: p.criado_em,
    propostas: Number(p.total_propostas),
    aceites: Number(p.total_aceites),
  }));

  const q = f.q.toLowerCase();
  const prestadores = todos.filter(
    (p) =>
      (f.situacao === "todos" || p.ativo === (f.situacao === "ativos")) &&
      (!q || [p.nome, p.email, p.empresa ?? ""].some((c) => c.toLowerCase().includes(q))),
  );

  return {
    prestadores,
    totais: {
      prestadores: todos.length,
      ativos: todos.filter((p) => p.ativo).length,
      suspensos: todos.filter((p) => !p.ativo).length,
      propostas: todos.reduce((s, p) => s + p.propostas, 0),
      aceites: todos.reduce((s, p) => s + p.aceites, 0),
    },
  };
}

export type ModeloGlobal = {
  id: string;
  nicho: Nicho;
  titulo: string;
  ativo: boolean;
  conteudo: ConteudoRascunho;
};

/** Todos os templates globais (ativos e inativos). O RLS deixa o admin ver todos. */
export async function listarModelosGlobais(): Promise<ModeloGlobal[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("templates")
    .select("id, nicho, titulo, ativo, conteudo")
    .is("dono_id", null)
    .order("titulo", { ascending: true });
  return (data ?? []).map((t) => ({
    id: t.id,
    nicho: t.nicho,
    titulo: t.titulo,
    ativo: t.ativo,
    conteudo: normalizarConteudo(t.conteudo),
  }));
}

export async function carregarModeloGlobal(id: string): Promise<ModeloGlobal | null> {
  const todos = await listarModelosGlobais();
  return todos.find((m) => m.id === id) ?? null;
}
