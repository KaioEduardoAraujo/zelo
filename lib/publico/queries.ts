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

/*
 * Leitura da proposta pela página pública. O cliente não tem conta: o acesso é só pelo
 * SERVIDOR, com a service_role, e só depois de conferir o token (regra inegociável nº 4).
 *
 * Token com formato errado, inexistente ou substituído por um link novo: tudo vira `null`, e a
 * página responde o mesmo "link inválido" (não revela se a proposta existe).
 */

export type EstadoPublico =
  "aberta" | "expirada" | "aceita" | "recusada" | "ajuste" | "em_atualizacao";

export type PropostaPublica = {
  /** Só para uso no servidor (ações). Nunca vai para um componente de cliente. */
  id: string;
  tipo: TipoDocumento;
  estado: EstadoPublico;
  titulo: string;
  /** Como o prestador aparece no documento (retrato do envio). */
  prestadorDocumento: { nome: string; empresa: string | null };
  /** Contato ATUAL do prestador, para "Tenho dúvidas". */
  contato: { nome: string; telefone: string | null; email: string };
  cliente: { nome: string; email: string };
  /** Proposta e aditivo. Em entrega é null (veja `entrega`). */
  conteudo: ConteudoRascunho | null;
  /** Só em entrega: checklist e fotos. */
  entrega: ConteudoEntrega | null;
  /** Caminho da foto → URL assinada (1 hora). Só em entrega. */
  fotoUrls: Record<string, string>;
  /** Aditivo e entrega: título da proposta aceita a que se referem. */
  referenciaTitulo: string | null;
  hash: string | null;
  enviadaEm: string | null;
  validadeEm: string | null;
  resposta: {
    /** Só para uso no servidor (download do comprovante). */
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
  if (!tokenValido(token)) return null; // lixo na URL nem chega ao banco

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

  // Uma nova versão está sendo editada (D50): a versão antiga não é mostrada nem aceita.
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
    // Service role: só assina fotos da pasta deste prestador e desta entrega (urlsDasFotos).
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
