import "server-only";

import { hashConfere } from "@/lib/crypto/hash";
import { normalizarConteudo } from "@/lib/proposals/draft";
import { normalizarEntrega, type ConteudoEntrega } from "@/lib/validation/entrega";
import { lerSnapshot, type SnapshotDocumento } from "@/lib/proposals/snapshot";
import type { EventoTipo } from "@/lib/status";
import { createServiceClient } from "@/lib/supabase/service";
import type { ConteudoRascunho } from "@/lib/validation/proposta";

/*
 * Tudo o que o comprovante (PDF) mostra, lido do banco com a service_role. Só é chamado no
 * servidor, depois de alguém ter provado que pode ver este aceite: o cliente pelo token do link,
 * o prestador pela sessão (e o RLS), ou o próprio servidor logo depois de gravar o aceite.
 */

export type EventoComprovante = {
  tipo: EventoTipo;
  criadoEm: string;
  ip: string | null;
  userAgent: string | null;
};

export type DadosComprovante = {
  aceite: {
    id: string;
    codigo: string;
    resultado: "aceito" | "recusado" | "ajuste";
    criadoEm: string;
    otpVerificadoEm: string;
    clienteNome: string;
    clienteCpf: string | null;
    comentario: string | null;
    ip: string | null;
    userAgent: string | null;
    textoConsentimento: string;
    hashDocumento: string;
    pdfPath: string | null;
  };
  proposta: { id: string; prestadorId: string; tipo: "proposta" | "aditivo" | "entrega" };
  versao: { id: string; numero: number; enviadaEm: string | null; hash: string };
  /** Retrato das partes no envio (D24). */
  partes: SnapshotDocumento;
  /** Proposta e aditivo. Em entrega vem vazio (veja `entrega`). */
  conteudo: ConteudoRascunho;
  /** Só em entrega. */
  entrega: ConteudoEntrega | null;
  /** O hash recalculado agora, a partir do conteúdo guardado, bate com o gravado? */
  integro: boolean;
  /** Trilha até o momento do aceite (inclusive). Eventos posteriores não entram no PDF. */
  eventos: EventoComprovante[];
  /** E-mail ATUAL do prestador (para mandar a cópia). Não vai para o PDF. */
  prestadorEmail: string;
};

export async function carregarDadosComprovante(aceiteId: string): Promise<DadosComprovante | null> {
  const svc = createServiceClient();

  const { data: a } = await svc
    .from("aceites")
    .select(
      "id, versao_id, resultado, comentario, criado_em, otp_verificado_em, cliente_nome, cliente_cpf, ip, user_agent, texto_consentimento, hash_documento, pdf_path, codigo_comprovante",
    )
    .eq("id", aceiteId)
    .maybeSingle();
  if (!a) return null;

  const { data: v } = await svc
    .from("proposta_versoes")
    .select("id, proposta_id, numero, conteudo, hash_sha256, enviada_em")
    .eq("id", a.versao_id)
    .single();
  if (!v?.hash_sha256) return null;

  const { data: p } = await svc
    .from("propostas")
    .select("id, prestador_id, tipo")
    .eq("id", v.proposta_id)
    .single();
  const partes = lerSnapshot(v.conteudo);
  if (!p || !partes) return null;

  const [{ data: eventos }, { data: perfil }] = await Promise.all([
    // `criado_em` é sempre now() (trigger) e now() é o mesmo durante a transação: o evento
    // "aceita", gravado junto com o aceite, tem exatamente o mesmo horário e entra no filtro.
    svc
      .from("auditoria_eventos")
      .select("tipo, ip, user_agent, criado_em")
      .eq("proposta_id", p.id)
      .lte("criado_em", a.criado_em)
      .order("criado_em", { ascending: true }),
    svc.from("profiles").select("email").eq("id", p.prestador_id).single(),
  ]);

  return {
    aceite: {
      id: a.id,
      codigo: a.codigo_comprovante,
      resultado: a.resultado,
      criadoEm: a.criado_em,
      otpVerificadoEm: a.otp_verificado_em,
      clienteNome: a.cliente_nome,
      clienteCpf: a.cliente_cpf,
      comentario: a.comentario,
      ip: a.ip === null ? null : String(a.ip),
      userAgent: a.user_agent,
      textoConsentimento: a.texto_consentimento,
      hashDocumento: a.hash_documento,
      pdfPath: a.pdf_path,
    },
    proposta: { id: p.id, prestadorId: p.prestador_id, tipo: p.tipo },
    versao: { id: v.id, numero: v.numero, enviadaEm: v.enviada_em, hash: v.hash_sha256 },
    partes,
    conteudo: normalizarConteudo(p.tipo === "entrega" ? null : v.conteudo),
    entrega: p.tipo === "entrega" ? normalizarEntrega(v.conteudo) : null,
    integro: hashConfere(v.conteudo, v.hash_sha256) && a.hash_documento === v.hash_sha256,
    eventos: (eventos ?? []).map((e) => ({
      tipo: e.tipo as EventoTipo,
      criadoEm: e.criado_em,
      ip: e.ip === null ? null : String(e.ip),
      userAgent: e.user_agent,
    })),
    prestadorEmail: perfil?.email ?? "",
  };
}
