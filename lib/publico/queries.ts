import "server-only";

import { hashToken, tokenValido } from "@/lib/crypto/token";
import { serverEnv } from "@/lib/env.server";
import { urlsDasFotos } from "@/lib/entregas/urls";
import { normalizarConteudo } from "@/lib/proposals/draft";
import type { TipoDocumento } from "@/lib/tipos";
import { normalizarEntrega, type ConteudoEntrega } from "@/lib/validation/entrega";
import { lerSnapshot } from "@/lib/proposals/snapshot";
import { createServiceClient } from "@/lib/supabase/service";
import type { ConteudoRascunho } from "@/lib/validation/proposta";

// Token inválido, inexistente ou substituído dão o mesmo null: não revela se a proposta existe.

export type EstadoPublico =
  "aberta" | "expirada" | "aceita" | "recusada" | "ajuste" | "em_atualizacao";

export type PropostaPublica = {
  id: string;
  tipo: TipoDocumento;
  estado: EstadoPublico;
  titulo: string;
  prestadorDocumento: { nome: string; empresa: string | null };
  contato: { nome: string; telefone: string | null; email: string };
  cliente: { nome: string; email: string };
  conteudo: ConteudoRascunho | null;
  entrega: ConteudoEntrega | null;
  fotoUrls: Record<string, string>;
  referenciaTitulo: string | null;
  hash: string | null;
  enviadaEm: string | null;
  validadeEm: string | null;
  resposta: {
    aceiteId: string;
    pdfPath: string | null;
    resultado: "aceito" | "recusado" | "ajuste";
    criadoEm: string;
    codigo: string;
    clienteNome: string;
    cpf: string | null;
    comentario: string | null;
  } | null;
};

const ESTADO: Record<string, EstadoPublico> = {
  enviada: "aberta",
  visualizada: "aberta",
  expirada: "expirada",
  aceita: "aceita",
  recusada: "recusada",
  ajuste_solicitado: "ajuste",
};

export async function carregarPropostaPublica(token: string): Promise<PropostaPublica | null> {
  if (!tokenValido(token)) return null;

  const svc = createServiceClient();
  const { data: p } = await svc
    .from("propostas_situacao")
    .select(
      "id, tipo, prestador_id, status, status_efetivo, versao_atual, validade_em, titulo, cliente_nome, cliente_email",
    )
    .eq("token_hash", hashToken(serverEnv().HASH_PEPPER, token))
    .maybeSingle();
  if (!p?.id || !p.prestador_id) return null;

  const { data: perfil } = await svc
    .from("profiles")
    .select("nome, empresa_nome, telefone, email")
    .eq("id", p.prestador_id)
    .single();
  const contato = {
    nome: perfil?.empresa_nome || perfil?.nome || "o prestador",
    telefone: perfil?.telefone ?? null,
    email: perfil?.email ?? "",
  };

  const tipo: TipoDocumento = p.tipo ?? "proposta";
  const base = {
    id: p.id,
    tipo,
    titulo: p.titulo ?? "",
    contato,
    cliente: { nome: p.cliente_nome ?? "", email: p.cliente_email ?? "" },
    validadeEm: p.validade_em,
  };

  // Nova versão em edição: a anterior não é mostrada nem aceita.
  if (p.status === "rascunho") {
    return {
      ...base,
      estado: "em_atualizacao",
      prestadorDocumento: { nome: perfil?.nome ?? "", empresa: perfil?.empresa_nome ?? null },
      conteudo: null,
      entrega: null,
      fotoUrls: {},
      referenciaTitulo: null,
      hash: null,
      enviadaEm: null,
      resposta: null,
    };
  }

  const { data: v } = await svc
    .from("proposta_versoes")
    .select("id, conteudo, hash_sha256, enviada_em")
    .eq("proposta_id", p.id)
    .eq("numero", p.versao_atual ?? 0)
    .maybeSingle();
  if (!v?.hash_sha256) return null;

  const snapshot = lerSnapshot(v.conteudo);
  const entrega = tipo === "entrega" ? normalizarEntrega(v.conteudo) : null;
  const { data: a } = await svc
    .from("aceites")
    .select(
      "id, pdf_path, resultado, criado_em, codigo_comprovante, cliente_nome, cliente_cpf, comentario",
    )
    .eq("versao_id", v.id)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ...base,
    titulo: snapshot?.titulo || base.titulo,
    estado: ESTADO[p.status_efetivo ?? ""] ?? "expirada",
    prestadorDocumento: snapshot?.prestador ?? {
      nome: perfil?.nome ?? "",
      empresa: perfil?.empresa_nome ?? null,
    },
    cliente: snapshot
      ? { nome: snapshot.cliente.nome, email: snapshot.cliente.email }
      : base.cliente,
    conteudo: tipo === "entrega" ? null : normalizarConteudo(v.conteudo),
    entrega,
    fotoUrls: entrega ? await urlsDasFotos(svc, entrega.fotos, p.prestador_id, p.id) : {},
    referenciaTitulo: snapshot?.referencia?.titulo || null,
    hash: v.hash_sha256,
    enviadaEm: v.enviada_em,
    resposta: a
      ? {
          aceiteId: a.id,
          pdfPath: a.pdf_path,
          resultado: a.resultado,
          criadoEm: a.criado_em,
          codigo: a.codigo_comprovante,
          clienteNome: a.cliente_nome,
          cpf: a.cliente_cpf,
          comentario: a.comentario,
        }
      : null,
  };
}
